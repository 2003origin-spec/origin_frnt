/**
 * Points are awarded once per reference (bug-fixes G6 + N4).
 *
 *  - `claimPointAward` against a stubbed pool: the first claim of
 *    (user, award_key) returns the row, the second returns null, and no
 *    Postgres means no claim at all.
 *  - `awardPoints` with a repeated (user, activityType, referenceId) awards
 *    once (in-process backstop over the hydrated point log).
 *  - `awardPointsOnce` claims `<activityType>:<referenceId>` before paying out.
 *  - Pomodoro length comes from the stored startTime, capped at 2 h.
 *
 * No database: the pool is a stub that records every statement.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  POMODORO_MAX_DURATION_SECONDS,
  awardPoints,
  pomodoroDurationFromStart,
} from "../../src/server/gamification";
import {
  activityAwardKey,
  assessmentAwardKey,
  awardPointsOnce,
  claimPointAward,
  type PointAwardPool,
} from "../../src/server/point-awards";
import { SCHEMA_DDL_LOCK_SQL } from "../../src/server/schema-lock";
import {
  RELEASE_POINT_AWARD_SQL,
  releasePointAwardClaims,
  withPointAwardClaimRollback,
} from "../../src/server/point-award-scope";
import {
  deductFarmedPoints,
  farmedAwardPoints,
  planPointAwardsBackfill,
  type BackfillAttempt,
  type BackfillPointLog,
} from "../../src/server/point-awards-backfill";

type StubCall = { text: string; values: unknown[] };

/** In-memory stand-in for app.point_awards: unique on (user_id, award_key). */
function makeStubPool() {
  const claimed = new Set<string>();
  const calls: StubCall[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    if (text.includes("INSERT INTO app.point_awards")) {
      const key = `${values[0]}|${values[1]}`;
      if (claimed.has(key)) return { rows: [], rowCount: 0 };
      claimed.add(key);
      return {
        rows: [{ user_id: values[0], award_key: values[1], points: values[2], reference_id: values[3] }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as PointAwardPool;
  return { pool, calls, claimed };
}

function makeStore() {
  return { userScores: [], pointLogs: [] } as any;
}

test("award keys: test/dpp use the assessment id, activities use type:reference", () => {
  assert.equal(assessmentAwardKey("test", "t1"), "test:t1");
  assert.equal(assessmentAwardKey("dpp", "d1"), "dpp:d1");
  assert.equal(activityAwardKey("study_corner", "book_1"), "study_corner:book_1");
});

test("claimPointAward: first claim returns the row, second claim returns null", async () => {
  const { pool, calls } = makeStubPool();
  const first = await claimPointAward("u1", "test:t1", 40, "result_a", pool);
  assert.deepEqual(first, { userId: "u1", awardKey: "test:t1", points: 40, referenceId: "result_a" });

  const second = await claimPointAward("u1", "test:t1", 55, "result_b", pool);
  assert.equal(second, null, "a resubmit of the same test must not claim again");

  // The conflict target is the composite key, never the attempt id.
  const inserts = calls.filter((c) => c.text.includes("INSERT INTO app.point_awards"));
  assert.equal(inserts.length, 2);
  assert.match(inserts[0].text, /ON CONFLICT \(user_id, award_key\) DO NOTHING/);
  assert.match(inserts[0].text, /RETURNING/);
});

test("claimPointAward: another user or another test is an independent claim", async () => {
  const { pool } = makeStubPool();
  assert.ok(await claimPointAward("u1", "test:t1", 10, "r1", pool));
  assert.ok(await claimPointAward("u2", "test:t1", 10, "r2", pool), "same test, different user");
  assert.ok(await claimPointAward("u1", "dpp:t1", 10, "r3", pool), "same id, different kind");
  assert.equal(await claimPointAward("u2", "test:t1", 10, "r4", pool), null);
});

test("claimPointAward: no Postgres means no durable claim and no points", async () => {
  assert.equal(await claimPointAward("u1", "test:t1", 10, "r1", null), null);
});

test("claimPointAward: a failing pool awards nothing instead of throwing", async () => {
  const pool = {
    query: async () => {
      throw new Error("connection refused");
    },
    connect: async () => {
      throw new Error("connection refused");
    },
  } as unknown as PointAwardPool;
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(await claimPointAward("u1", "test:t1", 10, "r1", pool), null);
  } finally {
    console.warn = originalWarn;
  }
});

test("runtime-ensure runs the DDL once per pool under the shared transaction lock", async () => {
  const { pool, calls } = makeStubPool();
  await claimPointAward("u1", "test:t1", 10, "r1", pool);
  await claimPointAward("u1", "test:t2", 10, "r2", pool);
  const ddl = calls.filter((c) => c.text.includes("CREATE TABLE IF NOT EXISTS app.point_awards"));
  assert.equal(ddl.length, 1, "DDL is memoised per pool");
  const texts = calls.map((c) => c.text);
  const begin = texts.indexOf("BEGIN");
  const lock = texts.indexOf(SCHEMA_DDL_LOCK_SQL);
  const commit = texts.indexOf("COMMIT");
  assert.ok(begin >= 0 && lock > begin && commit > lock, "BEGIN → advisory xact lock → DDL → COMMIT");
  assert.ok(!texts.some((t) => /pg_advisory_lock\(/.test(t)), "never a session-scoped lock");
});

test("awardPoints: a repeated (user, activityType, referenceId) awards once", () => {
  const store = makeStore();
  const first = awardPoints(store, "u1", 10, "study_corner", "Saved book", "book_1");
  assert.ok(first);
  const again = awardPoints(store, "u1", 10, "study_corner", "Saved book", "book_1");
  assert.equal(again, null, "save → unsave → save must not pay out again");
  assert.equal(store.userScores[0].totalPoints, 10);
  assert.equal(store.pointLogs.length, 1);

  // A different activity type over the same reference is a different award.
  assert.ok(awardPoints(store, "u1", 5, "ai_solver", "Something else", "book_1"));
  // Another user is independent.
  assert.ok(awardPoints(store, "u2", 10, "study_corner", "Saved book", "book_1"));
  // No reference ⇒ no dedupe (legacy callers without ids are unchanged).
  assert.ok(awardPoints(store, "u1", 1, "misc", "a"));
  assert.ok(awardPoints(store, "u1", 1, "misc", "b"));
});

test("awardPointsOnce: claims <activityType>:<referenceId> and pays out only on the first call", async () => {
  const { pool, claimed } = makeStubPool();
  const store = makeStore();

  const first = await awardPointsOnce(store, "u1", 20, "pomodoro", "Completed focus", "pomo_1", pool);
  assert.ok(first);
  assert.ok(claimed.has("u1|pomodoro:pomo_1"));

  // Even on a fresh store (another instance), the durable claim blocks it.
  const freshStore = makeStore();
  const second = await awardPointsOnce(freshStore, "u1", 20, "pomodoro", "Completed focus", "pomo_1", pool);
  assert.equal(second, null);
  assert.equal(freshStore.pointLogs.length, 0);
  assert.equal(store.userScores[0].totalPoints, 20);

  // Non-positive points never claim.
  assert.equal(await awardPointsOnce(store, "u1", 0, "pomodoro", "zero", "pomo_2", pool), null);
  assert.ok(!claimed.has("u1|pomodoro:pomo_2"));

  // No Postgres ⇒ nothing awarded.
  assert.equal(await awardPointsOnce(makeStore(), "u1", 20, "pomodoro", "x", "pomo_3", null), null);
});

test("pomodoroDurationFromStart: elapsed since the stored startTime, capped at 2 h", () => {
  const start = Date.parse("2026-10-22T10:00:00.000Z");
  assert.equal(pomodoroDurationFromStart("2026-10-22T10:00:00.000Z", start + 25 * 60_000), 25 * 60);
  // A client claiming 1200 s one second after starting gets 1 s.
  assert.equal(pomodoroDurationFromStart("2026-10-22T10:00:00.000Z", start + 1_000), 1);
  // Clock skew / future start never goes negative.
  assert.equal(pomodoroDurationFromStart("2026-10-22T10:00:00.000Z", start - 5_000), 0);
  // Cap at 2 h.
  assert.equal(pomodoroDurationFromStart("2026-10-22T10:00:00.000Z", start + 5 * 3600_000), POMODORO_MAX_DURATION_SECONDS);
  assert.equal(POMODORO_MAX_DURATION_SECONDS, 7200);
  // Unparseable start ⇒ 0 (no reward).
  assert.equal(pomodoroDurationFromStart("not-a-date", start), 0);
});

test("the point_awards migration is applied at build, on the USER database, in date order", () => {
  const runner = readFileSync(join(process.cwd(), "scripts/run-migrations.mjs"), "utf8");
  const entries = [...runner.matchAll(/\{ file: "([^"]+\.sql)", target: "(\w+)" \}/g)].map((m) => ({ file: m[1], target: m[2] }));
  const entry = entries.find((e) => e.file === "20261022_point_awards.sql");
  assert.ok(entry, "20261022_point_awards.sql is not registered in run-migrations.mjs, so it would never apply");
  // app.point_awards has an FK to origin_users, which lives on the USER pool.
  assert.equal(entry.target, "user");
  const dates = entries.map((e) => e.file.slice(0, 8));
  assert.deepEqual(dates, [...dates].sort(), "run-migrations.mjs entries must stay in date order");
});

// ── L2: a claim is released when the store write it belongs to fails ───────

test("withPointAwardClaimRollback: a throw after a claim deletes that exact claim", async () => {
  const { pool, calls } = makeStubPool();
  const release = { calls: [] as unknown[][], query: async (_sql: string, params: unknown[]) => void release.calls.push(params) };
  await assert.rejects(
    withPointAwardClaimRollback(async () => {
      assert.ok(await claimPointAward("u1", "test:t1", 40, "result_a", pool));
      // A claim that loses (already taken) must not be released by this request.
      assert.equal(await claimPointAward("u1", "test:t1", 40, "result_b", pool), null);
      throw new Error("persist failed");
    }, () => release),
    /persist failed/,
  );
  assert.deepEqual(release.calls, [["u1", "test:t1", "result_a"]]);
  assert.equal(calls.filter((c) => c.text.includes("INSERT INTO app.point_awards")).length, 2);
});

test("withPointAwardClaimRollback: success keeps the claim; claims outside a scope are not tracked", async () => {
  const { pool } = makeStubPool();
  const release = { calls: [] as unknown[][], query: async (_sql: string, params: unknown[]) => void release.calls.push(params) };
  const value = await withPointAwardClaimRollback(async () => {
    await claimPointAward("u1", "dpp:d1", 10, "attempt_1", pool);
    return "ok";
  }, () => release);
  assert.equal(value, "ok");
  assert.deepEqual(release.calls, []);

  // Outside any scope: nothing is tracked, so a later failing scope releases nothing of it.
  await claimPointAward("u2", "dpp:d1", 10, "attempt_2", pool);
  await assert.rejects(withPointAwardClaimRollback(async () => {
    throw new Error("boom");
  }, () => release));
  assert.deepEqual(release.calls, []);
});

test("releasePointAwardClaims matches user + key + reference exactly and never throws", async () => {
  assert.match(RELEASE_POINT_AWARD_SQL, /user_id = \$1 AND award_key = \$2 AND reference_id IS NOT DISTINCT FROM \$3/);
  const failing = { query: async () => { throw new Error("db down"); } };
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(await releasePointAwardClaims([{ userId: "u", awardKey: "test:t", referenceId: null }], failing), 0);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(await releasePointAwardClaims([{ userId: "u", awardKey: "test:t", referenceId: null }], null), 0);
});

// ── M8: the backfill only deducts duplicate awards ──────────────────────────

const attempt = (id: string, userId: string, awardKey: string, score: number, createdAt: string): BackfillAttempt => ({
  id,
  userId,
  awardKey,
  score,
  createdAt,
});
const log = (
  id: string,
  userId: string,
  points: number,
  referenceId: string | null,
  activityType = "practice",
  farmedAlready = false,
): BackfillPointLog => ({ id, userId, points, activityType, referenceId, farmedAlready });

test("backfill plan: deducts only the duplicate awards from the STORED total, not a ledger recompute", () => {
  const plan = planPointAwardsBackfill({
    attempts: [
      attempt("r1", "u1", "test:t1", 40, "2026-10-01"),
      attempt("r2", "u1", "test:t1", 50, "2026-10-02"), // resubmit → farmed
      attempt("r3", "u1", "test:t1", 60, "2026-10-03"), // resubmit → farmed
      attempt("d1", "u1", "dpp:p1", 0, "2026-10-01"), // zero score: not rewardable
      attempt("d2", "u1", "dpp:p1", 12, "2026-10-02"), // first rewardable DPP attempt
    ],
    logs: [
      log("l1", "u1", 40, "r1"),
      log("l2", "u1", 50, "r2"),
      log("l3", "u1", 60, "r3"),
      log("l4", "u1", 12, "d2", "dpp"),
      log("l5", "u1", 10, "book_1", "study_corner"), // other activity: never touched
    ],
    // Stored total includes 300 legit points whose log rows the N3 race erased.
    storedTotals: new Map([["u1", 472]]),
  });
  assert.deepEqual(plan.farmedLogs.map((l) => l.id), ["l2", "l3"]);
  assert.equal(plan.farmers.length, 1);
  const [farmer] = plan.farmers;
  assert.equal(farmer.farmedPoints, 110);
  assert.equal(farmer.newTotal, 362, "472 − 110: the erased-but-legit 300 survive");
  assert.equal(farmer.ledgerTotal, 62, "the ledger number is reported, never applied");
  assert.deepEqual(plan.firstRewardable.map((a) => a.id).sort(), ["d2", "r1"]);
});

test("backfill plan: flagged rows are skipped (re-run deducts nothing), other users and negatives are untouched", () => {
  const plan = planPointAwardsBackfill({
    attempts: [attempt("r1", "u1", "test:t1", 40, "2026-10-01"), attempt("r2", "u1", "test:t1", 50, "2026-10-02")],
    logs: [
      log("l1", "u1", 40, "r1"),
      log("l2", "u1", 50, "r2", "practice", true), // already flagged by an earlier run
      log("l3", "u2", 50, "r2"), // another user's row pointing at u1's attempt
    ],
    storedTotals: new Map([
      ["u1", 40],
      ["u2", 50],
    ]),
  });
  assert.deepEqual(plan.farmers, []);
  assert.deepEqual(plan.nonFarmerMismatches, []);
});

test("deductFarmedPoints floors at zero and ignores non-positive deductions", () => {
  assert.equal(deductFarmedPoints(100, 30), 70);
  assert.equal(deductFarmedPoints(20, 30), 0);
  assert.equal(deductFarmedPoints(null, 30), 0);
  assert.equal(deductFarmedPoints(100, -5), 100);
  assert.equal(farmedAwardPoints(-4), 0);
  assert.equal(farmedAwardPoints(Number.NaN), 0);
});
