/**
 * The whole-store snapshot after the per-user hot paths stopped refreshing it
 * (review of fix/store-hot-paths): stale-while-revalidate past the TTL, user
 * writes replayed onto a hydration that was already in flight, the caller's
 * own rows overlaid fresh for progress reads, and the deck answer / doubts GET
 * authenticating without waiting for (or trusting) the snapshot. Fake pool.
 */

import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import {
  foldUserIntoStore,
  invalidateStoreCache,
  OWN_OGCODE_STATS_LOADS,
  readStoreAsync,
  readStoreWithFreshUserRows,
  withUserStoreScoped,
  type StoredUser,
} from "../../src/server/store";
import { authedRequest, installFakeUserPool, userRow } from "./_scoped-store-fakes";

process.env.TEACHER_LAUNCH_OGCODE_SCORING_V2 = "0";

const USER = "user_snapshot_fresh_a";
const OTHER = "user_snapshot_fresh_b";
const TTL_MS = 5 * 60 * 1000;

type Handler = (request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) => Promise<Response>;

const FULL_USERS = "SELECT * FROM origin_users ORDER BY joined_at ASC";

function fullTableReads(sql: string[]): string[] {
  return sql.filter((s) => /^SELECT (data|\*) FROM app\.[a-z_]+ ORDER BY/.test(s) || s === FULL_USERS);
}

function attempt(userId: string, id: string, questionId: string, isCorrect: boolean) {
  return { id, userId, questionId, isCorrect, answer: "x", timeSpent: 1, createdAt: "2026-11-01T00:00:00.000Z" };
}

function activity(userId: string, date: string, webpageTime = 0) {
  return { userId, date, questionsPracticed: 0, webpageTime, practiceTime: 0, pomodoroTime: 0 };
}

/** A clock the store's TTL reads; returns a setter. */
function fakeClock(t: { after: (fn: () => void) => void }, start = Date.parse("2026-11-03T06:00:00.000Z")) {
  let now = start;
  const spy = mock.method(Date, "now", () => now);
  t.after(() => spy.mock.restore());
  return {
    advance(ms: number) {
      now += ms;
    },
  };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

// ── stale-while-revalidate ──────────────────────────────────────────────────

test("readStoreAsync past the TTL serves the old snapshot at once and refreshes it once in the background", async (t) => {
  const clock = fakeClock(t);
  let generation = 1;
  const sql = installFakeUserPool({
    rowsFor: (statement) => (statement === FULL_USERS ? [userRow(USER, { name: `gen ${generation}` })] : undefined),
  });
  invalidateStoreCache();
  const first = await readStoreAsync();
  assert.equal(first.users.find((u) => u.id === USER)?.name, "gen 1");

  generation = 2;
  clock.advance(TTL_MS + 1);
  sql.length = 0;
  const stale = await readStoreAsync();
  const staleAgain = await readStoreAsync();
  assert.equal(stale, first, "the expired snapshot is returned without waiting");
  assert.equal(staleAgain, first);
  await settle();
  assert.equal(sql.filter((s) => s === FULL_USERS).length, 1, "exactly one background hydration");

  const refreshed = await readStoreAsync();
  assert.notEqual(refreshed, first);
  assert.equal(refreshed.users.find((u) => u.id === USER)?.name, "gen 2");
});

test("readStoreAsync blocks when the snapshot is older than the stale window (or there is none)", async (t) => {
  const clock = fakeClock(t);
  let generation = 1;
  installFakeUserPool({
    rowsFor: (statement) => (statement === FULL_USERS ? [userRow(USER, { name: `gen ${generation}` })] : undefined),
  });
  invalidateStoreCache();
  await readStoreAsync();

  generation = 2;
  clock.advance(2 * TTL_MS + 1);
  const store = await readStoreAsync();
  assert.equal(store.users.find((u) => u.id === USER)?.name, "gen 2", "too old to serve: waited for the fresh load");
});

test("a failed background refresh keeps the snapshot and the next request tries again", async (t) => {
  const clock = fakeClock(t);
  let fail = false;
  const sql = installFakeUserPool({
    rowsFor: (statement) => (statement === FULL_USERS ? [userRow(USER)] : undefined),
    failFor: (statement) => fail && statement === FULL_USERS,
  });
  const errors = mock.method(console, "error", () => undefined);
  t.after(() => errors.mock.restore());
  invalidateStoreCache();
  const first = await readStoreAsync();

  fail = true;
  clock.advance(TTL_MS + 1);
  assert.equal(await readStoreAsync(), first);
  await settle();
  assert.equal(await readStoreAsync(), first, "still served after the failure");
  await settle();
  assert.equal(sql.filter((s) => s === FULL_USERS).length, 3, "initial load + two refresh attempts");
});

// ── writes during a hydration ───────────────────────────────────────────────

test("a user write that commits while a hydration is in flight is replayed onto it", async (t) => {
  const clock = fakeClock(t);
  const today = "2026-11-03";
  const hold = deferred();
  let holding = false;
  installFakeUserPool({
    holdFor: (statement) => (holding && statement.startsWith("SELECT data FROM app.daily_activities ORDER BY") ? hold.promise : undefined),
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      if (statement === FULL_USERS) return [userRow(USER), userRow(OTHER)];
      if (statement.startsWith("SELECT data FROM app.daily_activities")) {
        // The database still answers with the pre-write row: the full read
        // was issued before the write committed.
        const mine = [{ data: activity(USER, today) }];
        return statement.includes("user_id = $1") ? mine : [...mine, { data: activity(OTHER, today) }];
      }
      return undefined;
    },
  });
  invalidateStoreCache();
  await readStoreAsync();

  clock.advance(TTL_MS + 1);
  holding = true;
  await readStoreAsync(); // stale: starts the background hydration, held open
  await settle();

  await withUserStoreScoped(
    USER,
    ["dailyActivities"],
    (store) => {
      store.dailyActivities.find((a) => a.userId === USER && a.date === today)!.webpageTime = 90;
    },
    { userId: USER, collections: ["dailyActivities"] },
  );
  hold.release();
  await settle();

  const after = await readStoreAsync();
  const mine = after.dailyActivities.find((a) => a.userId === USER && a.date === today)!;
  assert.equal(mine.webpageTime, 90, "the committed write survives the older hydration");
  assert.ok(after.dailyActivities.some((a) => a.userId === OTHER), "the hydration's other rows are cached");
});

test("a hydration overtaken by an invalidation is not cached", async (t) => {
  const clock = fakeClock(t);
  const hold = deferred();
  let holding = false;
  let generation = 1;
  const sql = installFakeUserPool({
    holdFor: (statement) => (holding && statement === FULL_USERS ? hold.promise : undefined),
    rowsFor: (statement) => (statement === FULL_USERS ? [userRow(USER, { name: `gen ${generation}` })] : undefined),
  });
  invalidateStoreCache();
  await readStoreAsync();

  clock.advance(TTL_MS + 1);
  holding = true;
  await readStoreAsync(); // background hydration, held
  invalidateStoreCache(); // e.g. a direct-SQL admin write
  hold.release();
  await settle();

  holding = false;
  generation = 2;
  sql.length = 0;
  const store = await readStoreAsync();
  assert.equal(sql.filter((s) => s === FULL_USERS).length, 1, "the overtaken result was dropped, so this loads again");
  assert.equal(store.users.find((u) => u.id === USER)?.name, "gen 2");
});

// ── the caller's own rows, fresh ────────────────────────────────────────────

test("readStoreWithFreshUserRows overlays the caller's fresh rows on a per-request copy", async () => {
  let freshAttempts = [attempt(USER, "pa_1", "q_1", false)];
  installFakeUserPool({
    rowsFor: (statement) => {
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER, { name: "fresh" })];
      if (statement === FULL_USERS) return [userRow(USER, { name: "snapshot" }), userRow(OTHER)];
      if (statement.startsWith("SELECT data FROM app.practice_attempts")) {
        if (statement.includes("user_id = $1")) return freshAttempts.map((data) => ({ data }));
        return [{ data: attempt(USER, "pa_1", "q_1", false) }, { data: attempt(OTHER, "pa_o", "q_1", true) }];
      }
      return undefined;
    },
  });
  invalidateStoreCache();
  const snapshot = await readStoreAsync();

  // Solved through another instance: the snapshot here never saw it.
  freshAttempts = [attempt(USER, "pa_2", "q_2", true), attempt(USER, "pa_1", "q_1", false)];
  const view = await readStoreWithFreshUserRows(USER, OWN_OGCODE_STATS_LOADS);

  assert.notEqual(view, snapshot);
  assert.deepEqual(
    view.practiceAttempts.filter((a) => a.userId === USER).map((a) => `${a.id}:${a.isCorrect}`).sort(),
    ["pa_1:false", "pa_2:true"],
  );
  assert.ok(view.practiceAttempts.some((a) => a.userId === OTHER), "other users' rows stay");
  assert.equal(view.users.find((u) => u.id === USER)?.name, "fresh");
  // Never cached, and the snapshot itself is untouched.
  assert.equal(await readStoreAsync(), snapshot);
  assert.equal(snapshot.practiceAttempts.some((a) => a.id === "pa_2"), false);
  assert.equal(snapshot.users.find((u) => u.id === USER)?.name, "snapshot");
});

test("readStoreWithFreshUserRows falls back to the snapshot when the fresh read fails", async (t) => {
  installFakeUserPool({
    rowsFor: (statement) => (statement === FULL_USERS ? [userRow(USER)] : undefined),
    failFor: (statement) => statement.startsWith("SELECT data FROM app.practice_attempts WHERE user_id"),
  });
  const errors = mock.method(console, "error", () => undefined);
  t.after(() => errors.mock.restore());
  invalidateStoreCache();
  const snapshot = await readStoreAsync();
  assert.equal(await readStoreWithFreshUserRows(USER, { practiceAttempts: true }), snapshot);
});

test("foldUserIntoStore updates the snapshot's copy in place, or adds a new account", () => {
  const existing = { id: USER, name: "old" } as StoredUser;
  const store = { users: [existing] } as unknown as Parameters<typeof foldUserIntoStore>[0];
  const updated = foldUserIntoStore(store, { id: USER, name: "new" } as StoredUser);
  assert.equal(updated, existing);
  assert.equal(existing.name, "new");
  const added = foldUserIntoStore(store, { id: OTHER, name: "brand new" } as StoredUser);
  assert.equal(store.users.length, 2);
  assert.equal(store.users[1], added);
});

// ── routes ───────────────────────────────────────────────────────────────────

test("deck answer on a cold instance does not wait for the whole-store hydration", async () => {
  const sql = installFakeUserPool({
    rowsFor: (statement) => (statement.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER)] : undefined),
  });
  invalidateStoreCache(); // cold: no snapshot at all
  const { POST } = (await import("../../src/app/api/assessments/[...slug]/route")) as unknown as Record<"POST", Handler>;
  const request = await authedRequest(USER, "http://localhost/api/assessments/practice/q_cold/submit", {
    method: "POST",
    body: JSON.stringify({ answer_text: "5", time_spent: 3 }),
    headers: { "content-type": "application/json" },
  });
  // The question lookup may 400 here (no catalog); only the loads matter.
  await POST(new NextRequest(request), { params: Promise.resolve({ slug: ["practice", "q_cold", "submit"] }) });
  assert.deepEqual(fullTableReads(sql), [], "no whole-store hydration for a deck answer");
});

test("deck answer: an unknown token is 401 and a failed user lookup is 503", async () => {
  const { POST } = (await import("../../src/app/api/assessments/[...slug]/route")) as unknown as Record<"POST", Handler>;
  const context = { params: Promise.resolve({ slug: ["practice", "q_x", "submit"] }) };
  const init = { method: "POST", body: "{}", headers: { "content-type": "application/json" } };

  installFakeUserPool(); // no such user row
  const missing = await POST(new NextRequest(await authedRequest(USER, "http://localhost/api/assessments/practice/q_x/submit", init)), context);
  assert.equal(missing.status, 401);

  installFakeUserPool({ failFor: (statement) => statement.startsWith("SELECT * FROM origin_users WHERE id = $1") });
  const errors = mock.method(console, "error", () => undefined);
  try {
    const down = await POST(new NextRequest(await authedRequest(USER, "http://localhost/api/assessments/practice/q_x/submit", init)), context);
    assert.equal(down.status, 503);
  } finally {
    errors.mock.restore();
  }
});

test("GET /api/interaction/doubts admits an account the snapshot predates", async () => {
  let rows = [userRow(OTHER)];
  installFakeUserPool({
    rowsFor: (statement) => {
      if (statement === FULL_USERS) return rows;
      if (statement.startsWith("SELECT * FROM origin_users WHERE id = $1")) return [userRow(USER)];
      return undefined;
    },
  });
  invalidateStoreCache();
  const snapshot = await readStoreAsync();
  assert.equal(snapshot.users.some((u) => u.id === USER), false, "signed up after this instance hydrated");
  rows = [userRow(OTHER), userRow(USER)];

  const { GET } = (await import("../../src/app/api/interaction/[...slug]/route")) as unknown as Record<"GET", Handler>;
  const request = await authedRequest(USER, "http://localhost/api/interaction/doubts");
  const response = await GET(new NextRequest(request), { params: Promise.resolve({ slug: ["doubts"] }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});
