/**
 * Phase 2 — the idempotency contract against a real Postgres.
 *
 * This is the guard that stops a double-tapped "Pay" button from creating two
 * Razorpay orders. Covers plan edge cases E1 (duplicate), E2 (key reused with a
 * different body), E3 (Redis down ⇒ still correct).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";
import { ensurePaymentsSchema } from "@/server/payments/payments-schema";
import {
  IN_FLIGHT_TAKEOVER_SECONDS,
  IdempotencyConflictError,
  hashRequest,
  purgeExpiredIdempotencyKeys,
  withIdempotency,
} from "@/server/payments/idempotency";
import {
  __resetPaymentsRedisForTests,
  __setPaymentsRedisForTests,
  type PaymentsRedis,
} from "@/server/payments/payments-redis";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };
let userId = "";

/** Minimal in-memory Redis honouring the nx / ex / px semantics we rely on. */
function fakeRedis(): PaymentsRedis & { store: Map<string, { v: string; exp: number }> } {
  const store = new Map<string, { v: string; exp: number }>();
  const live = (key: string) => {
    const e = store.get(key);
    if (!e) return null;
    if (e.exp && e.exp <= Date.now()) {
      store.delete(key);
      return null;
    }
    return e;
  };
  return {
    store,
    async get(key) {
      return live(key)?.v ?? null;
    },
    async set(key, value, o) {
      if (o?.nx && live(key)) return null;
      const ttl = o?.px ?? (o?.ex ? o.ex * 1000 : 0);
      store.set(key, { v: value, exp: ttl ? Date.now() + ttl : 0 });
      return "OK";
    },
    async del(...keys) {
      let n = 0;
      for (const key of keys) if (store.delete(key)) n += 1;
      return n;
    },
  };
}

test("setup", opts, async () => {
  await ensurePaymentsSchema();
  __setPaymentsRedisForTests(null); // default: prove correctness with NO Redis (E3)
  userId = makeId("user_idem");
  await rawPool().query(
    `INSERT INTO origin_users (id, email, name, password_hash, role)
     VALUES ($1,$2,'Idem','x','student') ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@example.com`],
  );
});

test("E1: a repeat with the same key and body replays without re-running", opts, async () => {
  const key = randomUUID();
  const body = { subject: "physics", termMonths: 3 };
  let calls = 0;
  const run = () =>
    withIdempotency({
      userId,
      key,
      endpoint: "/api/payments/checkout",
      body,
      fn: async () => {
        calls += 1;
        return { orderId: `ord_${calls}`, amountMinor: 134700 };
      },
    });

  const first = await run();
  assert.equal(first.replayed, false);
  assert.equal(first.result.orderId, "ord_1");

  const second = await run();
  assert.equal(second.replayed, true, "second call must replay");
  assert.deepEqual(second.result, first.result, "identical response");
  assert.equal(calls, 1, "the handler ran exactly once");

  // Key order in the retry body must not matter (stable hashing).
  const reordered = await withIdempotency({
    userId,
    key,
    endpoint: "/api/payments/checkout",
    body: { termMonths: 3, subject: "physics" },
    fn: async () => {
      calls += 1;
      return { orderId: "SHOULD_NOT_HAPPEN", amountMinor: 0 };
    },
  });
  assert.equal(reordered.replayed, true);
  assert.equal(calls, 1);
});

test("E2: the same key with a DIFFERENT body is a 422, not a silent replay", opts, async () => {
  const key = randomUUID();
  await withIdempotency({
    userId,
    key,
    endpoint: "/api/payments/checkout",
    body: { subject: "physics", termMonths: 1 },
    fn: async () => ({ orderId: "ord_a" }),
  });

  await assert.rejects(
    () =>
      withIdempotency({
        userId,
        key,
        endpoint: "/api/payments/checkout",
        // 12 months is a very different amount — replaying the 1-month response
        // would hand the student a year of access for a month's money.
        body: { subject: "physics", termMonths: 12 },
        fn: async () => ({ orderId: "ord_b" }),
      }),
    (error: unknown) =>
      error instanceof IdempotencyConflictError &&
      error.status === 422 &&
      /different request parameters/.test(error.message),
  );
});

test("the same key for a DIFFERENT user is unrelated", opts, async () => {
  const key = randomUUID();
  const other = makeId("user_idem");
  await rawPool().query(
    `INSERT INTO origin_users (id, email, name, password_hash, role)
     VALUES ($1,$2,'Other','x','student') ON CONFLICT (id) DO NOTHING`,
    [other, `${other}@example.com`],
  );
  const a = await withIdempotency({ userId, key, endpoint: "/e", body: { v: 1 }, fn: async () => "A" });
  const b = await withIdempotency({ userId: other, key, endpoint: "/e", body: { v: 1 }, fn: async () => "B" });
  assert.equal(a.result, "A");
  assert.equal(b.result, "B", "another user's key must not collide");
  assert.equal(b.replayed, false);
});

test("E1 under real concurrency: the handler runs exactly once", opts, async () => {
  const key = randomUUID();
  let calls = 0;
  const slow = () =>
    withIdempotency({
      userId,
      key,
      endpoint: "/api/payments/checkout",
      body: { subject: "biology", termMonths: 1 },
      fn: async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 120)); // simulate the Razorpay call
        return { orderId: `ord_${calls}` };
      },
    });

  // Five simultaneous double-taps.
  const settled = await Promise.allSettled([slow(), slow(), slow(), slow(), slow()]);
  const ok = settled.filter((s) => s.status === "fulfilled");
  const conflicts = settled.filter(
    (s) => s.status === "rejected" && (s.reason as IdempotencyConflictError)?.status === 409,
  );

  assert.equal(calls, 1, "exactly one Razorpay order would have been created");
  assert.equal(ok.length + conflicts.length, 5, "every caller got a definite answer");
  assert.ok(ok.length >= 1, "at least one caller succeeded");
  assert.ok(conflicts.length >= 1, "the losers got a retryable 409, never a second charge");

  // After it settles, a retry replays the stored response rather than 409-ing.
  const after = await slow();
  assert.equal(after.replayed, true);
  assert.equal(calls, 1);
});

test("a failing handler releases the key so an honest retry can proceed", opts, async () => {
  const key = randomUUID();
  let calls = 0;
  const run = (shouldFail: boolean) =>
    withIdempotency({
      userId,
      key,
      endpoint: "/api/payments/checkout",
      body: { subject: "chemistry", termMonths: 1 },
      fn: async () => {
        calls += 1;
        if (shouldFail) throw new Error("razorpay unavailable");
        return { orderId: "ord_ok" };
      },
    });

  await assert.rejects(() => run(true), /razorpay unavailable/);
  // Failures must NOT be cached — the student has to be able to try again.
  const retry = await run(false);
  assert.equal(retry.replayed, false);
  assert.equal(retry.result.orderId, "ord_ok");
  assert.equal(calls, 2);
});

test("a crashed request's key is taken over once it goes stale, not wedged for 24h", opts, async () => {
  const key = randomUUID();
  const storageKey = `${userId}:${key}`;
  const body = { subject: "physics", termMonths: 1 };
  // Simulate a process that claimed the key for THIS body and died before
  // finishing. An honest retry of the same purchase must be able to recover it.
  await rawPool().query(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, created_at)
     VALUES ($1,$2,'/api/payments/checkout',$4,'in_flight', NOW() - make_interval(secs => $3))`,
    [storageKey, userId, IN_FLIGHT_TAKEOVER_SECONDS + 30, hashRequest("/api/payments/checkout", body)],
  );

  const result = await withIdempotency({
    userId,
    key,
    endpoint: "/api/payments/checkout",
    body,
    fn: async () => ({ orderId: "ord_recovered" }),
  });
  assert.equal(result.replayed, false);
  assert.equal(result.result.orderId, "ord_recovered");
});

test("a stale key may NOT be repurposed for a different purchase", opts, async () => {
  const key = randomUUID();
  // The takeover is deliberately narrower than "any request may adopt a stale
  // key": an idempotency key is bound to its payload for its whole lifetime.
  // Without this, a client that crashed mid-₹499 checkout and retried with a
  // ₹4,491 body would silently get the expensive order under the same key.
  await rawPool().query(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, created_at)
     VALUES ($1,$2,'/api/payments/checkout',$3,'in_flight', NOW() - make_interval(secs => $4))`,
    [
      `${userId}:${key}`,
      userId,
      hashRequest("/api/payments/checkout", { subject: "physics", termMonths: 1 }),
      IN_FLIGHT_TAKEOVER_SECONDS + 30,
    ],
  );
  await assert.rejects(
    () =>
      withIdempotency({
        userId, key, endpoint: "/api/payments/checkout",
        body: { subject: "physics", termMonths: 12 },
        fn: async () => ({ orderId: "ord_expensive" }),
      }),
    (e: unknown) => e instanceof IdempotencyConflictError && e.status === 422,
  );
});

test("a FRESH in-flight claim is respected (409), not stolen", opts, async () => {
  const key = randomUUID();
  const body = { subject: "physics", termMonths: 1 };
  // Seed with the MATCHING hash so this isolates the in-flight path. (With a
  // mismatched hash the 422 fires first, which is the correct precedence: a key
  // reused with different parameters is a client bug regardless of state — the
  // test below pins that ordering.)
  await rawPool().query(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, created_at)
     VALUES ($1,$2,'/api/payments/checkout',$3,'in_flight', NOW())`,
    [`${userId}:${key}`, userId, hashRequest("/api/payments/checkout", body)],
  );
  await assert.rejects(
    () =>
      withIdempotency({
        userId, key, endpoint: "/api/payments/checkout", body,
        fn: async () => ({ orderId: "ord_stolen" }),
      }),
    (e: unknown) => e instanceof IdempotencyConflictError && e.status === 409,
  );
});

test("a mismatched body outranks the in-flight state (422 beats 409)", opts, async () => {
  const key = randomUUID();
  await rawPool().query(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, created_at)
     VALUES ($1,$2,'/api/payments/checkout',$3,'in_flight', NOW())`,
    [`${userId}:${key}`, userId, hashRequest("/api/payments/checkout", { subject: "physics", termMonths: 1 })],
  );
  // Reusing a key for a DIFFERENT purchase is a client bug worth naming
  // precisely — telling them "try again shortly" would send them into a retry
  // loop that can never succeed.
  await assert.rejects(
    () =>
      withIdempotency({
        userId, key, endpoint: "/api/payments/checkout",
        body: { subject: "biology", termMonths: 12 },
        fn: async () => ({ orderId: "nope" }),
      }),
    (e: unknown) => e instanceof IdempotencyConflictError && e.status === 422,
  );
});

test("no key supplied ⇒ the handler runs every time (caller must require one)", opts, async () => {
  let calls = 0;
  const run = () =>
    withIdempotency({
      userId, key: null, endpoint: "/e", body: {},
      fn: async () => { calls += 1; return calls; },
    });
  await run();
  await run();
  assert.equal(calls, 2);
});

test("E3: behaviour is identical WITH Redis — and the replay skips Postgres", opts, async () => {
  const redis = fakeRedis();
  __setPaymentsRedisForTests(redis);
  try {
    const key = randomUUID();
    const body = { subject: "physics", termMonths: 12 };
    let calls = 0;
    const run = () =>
      withIdempotency({
        userId, key, endpoint: "/api/payments/checkout", body,
        fn: async () => { calls += 1; return { orderId: `ord_r${calls}` }; },
      });

    const first = await run();
    assert.equal(first.replayed, false);
    assert.ok(redis.store.size > 0, "the completed response was cached");

    const second = await run();
    assert.equal(second.replayed, true);
    assert.deepEqual(second.result, first.result);
    assert.equal(calls, 1);

    // A mismatched body must still be caught on the Redis fast path, not just in PG.
    await assert.rejects(
      () =>
        withIdempotency({
          userId, key, endpoint: "/api/payments/checkout",
          body: { subject: "physics", termMonths: 1 },
          fn: async () => ({ orderId: "nope" }),
        }),
      (e: unknown) => e instanceof IdempotencyConflictError && e.status === 422,
    );

    // Evicting the cache must not change the answer — Postgres is the truth.
    redis.store.clear();
    const afterEvict = await run();
    assert.equal(afterEvict.replayed, true, "still a replay after a Redis eviction");
    assert.equal(calls, 1);
  } finally {
    __setPaymentsRedisForTests(null);
  }
});

test("the expiry sweep removes only expired rows", opts, async () => {
  const liveKey = `${userId}:${randomUUID()}`;
  const deadKey = `${userId}:${randomUUID()}`;
  await rawPool().query(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, expires_at)
     VALUES ($1,$2,'/e','h','completed', NOW() + INTERVAL '1 hour'),
            ($3,$2,'/e','h','completed', NOW() - INTERVAL '1 hour')`,
    [liveKey, userId, deadKey],
  );
  const removed = await purgeExpiredIdempotencyKeys();
  assert.ok(removed >= 1, "at least the expired row was purged");
  const { rows } = await rawPool().query(
    `SELECT key FROM payments.idempotency_keys WHERE key = ANY($1::text[])`,
    [[liveKey, deadKey]],
  );
  assert.deepEqual(rows.map((r) => r.key), [liveKey], "the unexpired row survived");
});

test("teardown", opts, async () => {
  __resetPaymentsRedisForTests();
  await closePool();
});
