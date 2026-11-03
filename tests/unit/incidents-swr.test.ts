/**
 * Incident snapshot: stale-while-revalidate for the Edge middleware
 * (finding edge-killswitch-redis-stall).
 *
 * The middleware runs in bom1 and Upstash sits next to iad1, so a blocking
 * snapshot read cost a request ~400 ms every time the 5 s cache expired. These
 * drive the real module with an injected fake Redis and pin:
 *  - a fresh snapshot answers with no Redis call;
 *  - a stale snapshot answers at once and refreshes in the background, ONE
 *    refresh shared by every concurrent caller, handed to waitUntil;
 *  - a brand-new isolate waits a bounded time, then falls back to "no
 *    overrides" and picks the real state up as soon as Redis answers;
 *  - an isolate whose snapshot is far past the TTL waits like a cold one;
 *  - the whole read is ONE MGET (flags + mode), flags set or not;
 *  - Redis errors keep the last known state and never reject;
 *  - a hung Redis call can never pin the shared refresh;
 *  - a local write is never overwritten by a refresh that started before it;
 *  - the blocking (Node) loader still waits for Redis and shares the refresh.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Short TTLs so "stale" is reachable in a unit test. Must be set before import.
process.env.INCIDENT_SNAPSHOT_TTL_MS = "50";
process.env.INCIDENT_EDGE_SNAPSHOT_TTL_MS = "100";
const NODE_TTL_MS = 50;
const TTL_MS = 100;
/** EDGE_MAX_STALE_MS in the module: 4 x the edge TTL. */
const MAX_STALE_MS = 4 * TTL_MS;

type Incidents = typeof import("../../src/server/incidents");
// Loaded in `before` (tsx compiles tests as CJS: no top-level await), after
// the env above is in place.
let incidents: Incidents;
const __setIncidentRedisForTests: Incidents["__setIncidentRedisForTests"] = (fake, options) =>
  incidents.__setIncidentRedisForTests(fake, options);
const findKillSwitchForPath: Incidents["findKillSwitchForPath"] = (p) => incidents.findKillSwitchForPath(p);
const getIncidentSnapshot: Incidents["getIncidentSnapshot"] = () => incidents.getIncidentSnapshot();
const getIncidentStateNonBlocking: Incidents["getIncidentStateNonBlocking"] = (o) => incidents.getIncidentStateNonBlocking(o);
const getRateLimitMode: Incidents["getRateLimitMode"] = () => incidents.getRateLimitMode();
const killSwitchForPath: Incidents["killSwitchForPath"] = (s, p) => incidents.killSwitchForPath(s, p);
const setFlagOverride: Incidents["setFlagOverride"] = (f, v) => incidents.setFlagOverride(f, v);

test.before(async () => {
  incidents = await import("../../src/server/incidents");
});

type FakeRedis = NonNullable<Parameters<Incidents["__setIncidentRedisForTests"]>[0]>;

type Fake = {
  redis: FakeRedis;
  store: Map<string, string>;
  calls: string[];
  /** Max number of Redis calls that were in flight at the same time. */
  maxConcurrent: () => number;
  /** Delay (ms) applied to every read; `Infinity` never answers until `release()`. */
  setDelay: (ms: number) => void;
  release: () => void;
  failNext: (n: number) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFake(initial: Record<string, string> = {}): Fake {
  const store = new Map(Object.entries(initial));
  const calls: string[] = [];
  let delay = 0;
  let failures = 0;
  let current = 0;
  let max = 0;
  let waiters: Array<() => void> = [];

  async function read<T>(name: string, fn: () => T): Promise<T> {
    calls.push(name);
    current += 1;
    max = Math.max(max, current);
    try {
      if (delay === Number.POSITIVE_INFINITY) await new Promise<void>((resolve) => waiters.push(resolve));
      else if (delay > 0) await sleep(delay);
      else await Promise.resolve();
      if (failures > 0) {
        failures -= 1;
        throw new Error("fake redis down");
      }
      return fn();
    } finally {
      current -= 1;
    }
  }

  const redis: FakeRedis = {
    mget: <TData extends unknown[]>(...keys: string[]) =>
      read("mget", () => keys.map((k) => store.get(k) ?? null) as TData),
    set: async (key, value) => {
      store.set(key, value);
      return "OK";
    },
    del: async (...keys) => {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    },
  };
  return {
    redis,
    store,
    calls,
    maxConcurrent: () => max,
    setDelay: (ms) => {
      delay = ms;
    },
    release: () => {
      const w = waiters;
      waiters = [];
      w.forEach((resolve) => resolve());
    },
    failNext: (n) => {
      failures = n;
    },
  };
}

function collectWaitUntil() {
  const promises: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => promises.push(p), promises };
}

test.afterEach(() => {
  __setIncidentRedisForTests(null);
});

test("cold isolate with a healthy Redis gets the real state on its first request", async () => {
  const fake = makeFake({ "incident:flag:contest": "off", "incident:rate-limit-mode": "strict" });
  __setIncidentRedisForTests(fake.redis);
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(state, "/api/contest/paper"), "contest");
  assert.equal(state.rateLimitMode, "strict");
});

test("a fresh snapshot answers without touching Redis", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  __setIncidentRedisForTests(fake.redis);
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  const before = fake.calls.length;
  const wait = collectWaitUntil();
  for (let i = 0; i < 5; i += 1) await getIncidentStateNonBlocking(wait);
  assert.equal(fake.calls.length, before);
  assert.equal(wait.promises.length, 0, "no background work while fresh");
});

test("the whole read is one MGET, with or without a flag set", async () => {
  const none = makeFake({ "incident:rate-limit-mode": "relaxed" });
  none.setDelay(10);
  __setIncidentRedisForTests(none.redis);
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(state.rateLimitMode, "relaxed");
  assert.deepEqual(none.calls, ["mget"]);

  const killed = makeFake({ "incident:flag:contest": "off", "incident:flag:notes": "on", "incident:rate-limit-mode": "strict" });
  __setIncidentRedisForTests(killed.redis);
  const s = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.deepEqual(killed.calls, ["mget"], "no KEYS scan and no second round trip when a flag is set");
  assert.equal(killSwitchForPath(s, "/api/contest/paper"), "contest");
  assert.equal(s.flagOverrides.get("notes"), true);
  assert.equal(s.rateLimitMode, "strict");
});

test("unknown override keys and junk values are ignored", async () => {
  const fake = makeFake({
    "incident:flag:notAFlag": "off",
    "incident:flag:contest": "maybe",
    "incident:rate-limit-mode": "panic",
  });
  __setIncidentRedisForTests(fake.redis);
  const s = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(s.flagOverrides.size, 0);
  assert.equal(s.rateLimitMode, "normal");
});

test("a stale snapshot is served at once; one shared refresh runs under waitUntil", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  __setIncidentRedisForTests(fake.redis);
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  await sleep(TTL_MS + 20);

  // Admin clears the kill elsewhere (another pod) — Redis changes, this
  // isolate's snapshot does not know yet.
  fake.store.delete("incident:flag:contest");
  fake.setDelay(Number.POSITIVE_INFINITY);
  const callsBefore = fake.calls.length;
  const wait = collectWaitUntil();

  const started = Date.now();
  const states = await Promise.all(Array.from({ length: 10 }, () => getIncidentStateNonBlocking(wait)));
  assert.ok(Date.now() - started < 50, "stale reads must not wait on Redis");
  for (const s of states) assert.equal(killSwitchForPath(s, "/api/contest/paper"), "contest", "stale state served");
  // One refresh (one MGET) for all ten requests.
  assert.equal(fake.calls.length - callsBefore, 1);
  assert.equal(wait.promises.length, 10, "every request keeps the isolate alive for the refresh");

  fake.release();
  await Promise.all(wait.promises);
  const after = await getIncidentStateNonBlocking();
  assert.equal(killSwitchForPath(after, "/api/contest/paper"), null, "refreshed state picked up");
});

test("cold isolate with a hung Redis answers within the bound with no overrides, then catches up", async () => {
  const fake = makeFake({ "incident:flag:contest": "off", "incident:rate-limit-mode": "lockdown" });
  fake.setDelay(Number.POSITIVE_INFINITY);
  __setIncidentRedisForTests(fake.redis);
  const wait = collectWaitUntil();

  const started = Date.now();
  const first = await getIncidentStateNonBlocking({ ...wait, coldWaitMs: 30 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 25 && elapsed < 200, `bounded wait, took ${elapsed} ms`);
  assert.equal(killSwitchForPath(first, "/api/contest/paper"), null);
  assert.equal(first.rateLimitMode, "normal");
  assert.equal(wait.promises.length, 1);

  // While the first read is still running, later requests do NOT wait again
  // and do not start a second read.
  const callsBefore = fake.calls.length;
  const again = Date.now();
  await getIncidentStateNonBlocking({ ...wait, coldWaitMs: 30 });
  assert.ok(Date.now() - again < 20, "no second cold wait on the same isolate");
  assert.equal(fake.calls.length, callsBefore, "joined the running refresh");

  fake.release();
  await Promise.all(wait.promises);
  const caughtUp = await getIncidentStateNonBlocking();
  assert.equal(killSwitchForPath(caughtUp, "/api/contest/paper"), "contest");
  assert.equal(caughtUp.rateLimitMode, "lockdown");
});

test("a Redis error keeps the last known state and never rejects", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  __setIncidentRedisForTests(fake.redis);
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  await sleep(TTL_MS + 20);

  fake.failNext(1);
  const wait = collectWaitUntil();
  const stale = await getIncidentStateNonBlocking(wait);
  await Promise.all(wait.promises);
  assert.equal(killSwitchForPath(stale, "/api/contest/paper"), "contest");
  const kept = await getIncidentStateNonBlocking();
  assert.equal(killSwitchForPath(kept, "/api/contest/paper"), "contest", "last known kill survives the outage");
});

test("a cold isolate whose first read fails falls back to no overrides", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  fake.failNext(1);
  __setIncidentRedisForTests(fake.redis);
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(state, "/api/contest/paper"), null);
  assert.equal(state.rateLimitMode, "normal");
});

test("a local write is not overwritten by a refresh that started before it", async () => {
  const fake = makeFake();
  fake.setDelay(Number.POSITIVE_INFINITY);
  __setIncidentRedisForTests(fake.redis);
  const wait = collectWaitUntil();
  // A refresh is in flight with the pre-write state (no overrides)...
  await getIncidentStateNonBlocking({ ...wait, coldWaitMs: 5 });
  // ...then the admin kills `contest` on this same process.
  await setFlagOverride("contest", "off");
  fake.setDelay(0);
  fake.release();
  await Promise.all(wait.promises);
  // The old refresh's "no overrides" result must not win.
  assert.equal(await findKillSwitchForPath("/api/contest/paper"), "contest");
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(state, "/api/contest/paper"), "contest");
  await setFlagOverride("contest", "clear");
  assert.equal(await findKillSwitchForPath("/api/contest/paper"), null);
});

test("the blocking (Node) loader still waits for Redis, and concurrent callers share one read", async () => {
  const fake = makeFake({ "incident:flag:contest": "off", "incident:rate-limit-mode": "strict" });
  fake.setDelay(20);
  __setIncidentRedisForTests(fake.redis);
  const [mode, killed, snap] = await Promise.all([
    getRateLimitMode(),
    findKillSwitchForPath("/api/contest/paper"),
    getIncidentSnapshot(),
  ]);
  assert.equal(mode, "strict");
  assert.equal(killed, "contest");
  assert.deepEqual(snap.flagOverrides, { contest: false });
  assert.equal(snap.snapshotTtlMs, NODE_TTL_MS);
  assert.equal(snap.edgeSnapshotTtlMs, TTL_MS);
  // One MGET for all three callers.
  assert.deepEqual(fake.calls, ["mget"]);
});

test("kill-switch exempt paths stay reachable through the non-blocking state too", async () => {
  const fake = makeFake({ "incident:flag:adminControlCenter": "off" });
  __setIncidentRedisForTests(fake.redis);
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(state, "/api/admin/users"), "adminControlCenter");
  assert.equal(killSwitchForPath(state, "/api/admin/incidents/kill_switch"), null);
  assert.equal(killSwitchForPath(state, "/api/admin/launch"), null);
});

test("the Node readers keep the short TTL; only the Edge reader uses the long one", async () => {
  const fake = makeFake({ "incident:rate-limit-mode": "strict" });
  __setIncidentRedisForTests(fake.redis);
  assert.equal(await getRateLimitMode(), "strict");
  await sleep(NODE_TTL_MS + 20); // stale for Node, still fresh for the Edge reader
  fake.store.set("incident:rate-limit-mode", "lockdown");
  const edge = await getIncidentStateNonBlocking();
  assert.equal(edge.rateLimitMode, "strict", "edge serves its fresh snapshot without a read");
  assert.equal(fake.calls.length, 1);
  assert.equal(await getRateLimitMode(), "lockdown", "Node re-reads after its own 5 s-style TTL");
  assert.equal(fake.calls.length, 2);
});

test("default TTLs: 5 s for Node readers, 30 s for the Edge reader", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../../src/server/incidents.ts", import.meta.url), "utf8");
  assert.match(source, /envMs\("INCIDENT_SNAPSHOT_TTL_MS", 5_000\)/);
  assert.match(source, /envMs\("INCIDENT_EDGE_SNAPSHOT_TTL_MS", 30_000\)/);
});

test("a hung Redis read cannot pin the blocking loader; a new refresh starts once Redis recovers", async () => {
  const fake = makeFake({ "incident:rate-limit-mode": "lockdown" });
  __setIncidentRedisForTests(fake.redis, { readTimeoutMs: 50 });
  assert.equal(await getRateLimitMode(), "lockdown");
  await sleep(NODE_TTL_MS + 20);

  fake.setDelay(Number.POSITIVE_INFINITY);
  const started = Date.now();
  const [mode, killed] = await Promise.all([getRateLimitMode(), findKillSwitchForPath("/api/contest/paper")]);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 40 && elapsed < 300, `bounded by the read timeout, took ${elapsed} ms`);
  assert.equal(mode, "lockdown", "last known state kept through the hang");
  assert.equal(killed, null);
  const hungCalls = fake.calls.length;

  // Redis recovers (the hung call is still pending) and the admin lifts lockdown.
  fake.setDelay(0);
  fake.store.set("incident:rate-limit-mode", "normal");
  await sleep(NODE_TTL_MS + 20);
  assert.equal(await getRateLimitMode(), "normal", "a fresh refresh ran instead of joining the hung one");
  assert.equal(fake.calls.length, hungCalls + 1);
  fake.release();
});

test("a cold Node reader with a hung Redis resolves within the bound", async () => {
  const fake = makeFake({ "incident:rate-limit-mode": "lockdown" });
  fake.setDelay(Number.POSITIVE_INFINITY);
  __setIncidentRedisForTests(fake.redis, { readTimeoutMs: 50 });
  const started = Date.now();
  assert.equal(await getRateLimitMode(), "normal", "fail-open default, as on any Redis error");
  assert.ok(Date.now() - started < 300);
  fake.release();
});

test("a hung refresh under the Edge reader settles within the bound, so waitUntil ends", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  __setIncidentRedisForTests(fake.redis, { readTimeoutMs: 50 });
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  await sleep(TTL_MS + 20);
  fake.setDelay(Number.POSITIVE_INFINITY);
  const wait = collectWaitUntil();
  const stale = await getIncidentStateNonBlocking(wait);
  assert.equal(killSwitchForPath(stale, "/api/contest/paper"), "contest");
  const started = Date.now();
  await Promise.all(wait.promises);
  assert.ok(Date.now() - started < 300, "background refresh gave up at the read timeout");
  const kept = await getIncidentStateNonBlocking();
  assert.equal(killSwitchForPath(kept, "/api/contest/paper"), "contest", "last known kill kept");
  fake.release();
});

test("cold isolate sees an active kill with the default cold wait when each Redis call takes 200 ms", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  fake.setDelay(200);
  __setIncidentRedisForTests(fake.redis);
  const state = await getIncidentStateNonBlocking();
  assert.equal(killSwitchForPath(state, "/api/contest/paper"), "contest");
});

test("a snapshot far past the TTL is not served at once: the reader waits for the refresh", async () => {
  const fake = makeFake({ "incident:flag:contest": "off" });
  __setIncidentRedisForTests(fake.redis);
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  await sleep(MAX_STALE_MS + 30); // the isolate sat idle

  fake.store.delete("incident:flag:contest"); // admin cleared it meanwhile
  fake.setDelay(30);
  const state = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(state, "/api/contest/paper"), null, "fresh state, not the minutes-old one");

  // The other way round: a kill set while the isolate was idle is seen at once.
  await sleep(MAX_STALE_MS + 30);
  fake.store.set("incident:flag:contest", "off");
  const again = await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  assert.equal(killSwitchForPath(again, "/api/contest/paper"), "contest");
});

test("a too-old snapshot with a hung Redis falls back to the old state, not the empty default, and waits once", async () => {
  const fake = makeFake({ "incident:flag:contest": "off", "incident:rate-limit-mode": "strict" });
  __setIncidentRedisForTests(fake.redis);
  await getIncidentStateNonBlocking({ coldWaitMs: 1_000 });
  await sleep(MAX_STALE_MS + 30);

  fake.setDelay(Number.POSITIVE_INFINITY);
  const wait = collectWaitUntil();
  const started = Date.now();
  const first = await getIncidentStateNonBlocking({ ...wait, coldWaitMs: 30 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 25 && elapsed < 200, `bounded wait, took ${elapsed} ms`);
  assert.equal(killSwitchForPath(first, "/api/contest/paper"), "contest");
  assert.equal(first.rateLimitMode, "strict");

  const again = Date.now();
  const second = await getIncidentStateNonBlocking({ ...wait, coldWaitMs: 30 });
  assert.ok(Date.now() - again < 20, "no second wait while the same read is running");
  assert.equal(killSwitchForPath(second, "/api/contest/paper"), "contest");
  fake.release();
  await Promise.all(wait.promises);
});
