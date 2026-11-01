import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPointsLeaderboardResult,
  buildRankedPointsSql,
  clampLeaderboardLimit,
  getGlobalPointsLeaderboard,
  getPointsRowForUser,
  getTopPointsRows,
  mergeTopWithViewer,
  type RankedPointsRow,
} from "../../src/server/leaderboard-points";
import { createPostgresPoolConfig } from "../../src/server/postgres-config";

function row(userId: string, rank: number, points: number): RankedPointsRow {
  return {
    userId,
    name: userId.toUpperCase(),
    username: userId,
    avatar: null,
    location: null,
    points,
    studyTime: 0,
    streak: 0,
    rank,
  };
}

test("returns empty result for no rows", () => {
  const result = buildPointsLeaderboardResult([], "me", 20);
  assert.deepEqual(result.leaderboard, []);
  assert.equal(result.myRank, null);
  assert.equal(result.myPoints, 0);
});

test("slices to top N and resolves the viewer's rank + points", () => {
  const rows = [row("a", 1, 900), row("me", 2, 800), row("c", 3, 700)];
  const result = buildPointsLeaderboardResult(rows, "me", 2);
  // Top 2 + the viewer (already inside top 2 here) → no duplicate.
  assert.deepEqual(result.leaderboard.map((e) => e.userId), ["a", "me"]);
  assert.equal(result.myRank, 2);
  assert.equal(result.myPoints, 800);
  assert.equal(result.leaderboard.find((e) => e.userId === "me")!.isMe, true);
});

test("always includes the viewer even when ranked below the top N", () => {
  const rows = [row("a", 1, 900), row("b", 2, 800), row("c", 3, 700), row("me", 42, 10)];
  const result = buildPointsLeaderboardResult(rows, "me", 3);
  const ids = result.leaderboard.map((e) => e.userId);
  assert.deepEqual(ids.slice(0, 3), ["a", "b", "c"]);
  assert.ok(ids.includes("me"), "viewer appended outside the top N");
  assert.equal(result.myRank, 42);
});

test("exposes prestige points through score/rankScore aliases for existing UI", () => {
  const rows = [row("me", 1, 1741)];
  const result = buildPointsLeaderboardResult(rows, "me", 20);
  const entry = result.leaderboard[0];
  assert.equal(entry.points, 1741);
  assert.equal(entry.score, 1741);
  assert.equal(entry.rankScore, 1741);
});

test("marks no one as me when the viewer is absent", () => {
  const rows = [row("a", 1, 900), row("b", 2, 800)];
  const result = buildPointsLeaderboardResult(rows, "ghost", 20);
  assert.equal(result.myRank, null);
  assert.ok(result.leaderboard.every((e) => !e.isMe));
});

// ── N7: rank + LIMIT in SQL, capped limit, global cache + separate my-row ──

type Query = { text: string; values: unknown[] };

function withFakeUserPool<T>(rows: Record<string, unknown>[], fn: (queries: Query[]) => Promise<T>): Promise<T> {
  const queries: Query[] = [];
  const url = "postgres://fake:fake@127.0.0.1:1/fake_leaderboard";
  const prevEnv = process.env.USER_DATABASE_URL;
  const g = globalThis as unknown as Record<string, unknown>;
  const prevPool = g.__originUserPool;
  const prevConn = g.__originUserPoolConnectionString;
  process.env.USER_DATABASE_URL = url;
  g.__originUserPool = {
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      return { rows };
    },
    end: async () => undefined,
  };
  g.__originUserPoolConnectionString = createPostgresPoolConfig(url, 25).connectionString;
  return fn(queries).finally(() => {
    if (prevEnv === undefined) delete process.env.USER_DATABASE_URL;
    else process.env.USER_DATABASE_URL = prevEnv;
    g.__originUserPool = prevPool;
    g.__originUserPoolConnectionString = prevConn;
  });
}

function rawRow(userId: string, rank: number, points: number) {
  return {
    user_id: userId, name: userId, username: userId, avatar: null, location: null,
    points: String(points), total_study_time: 0, streak: 0, rank: String(rank),
  };
}

test("clampLeaderboardLimit caps at 1000 and maps 'all' to the cap", () => {
  assert.equal(clampLeaderboardLimit("all"), 1000);
  assert.equal(clampLeaderboardLimit(100_000), 1000);
  assert.equal(clampLeaderboardLimit("50"), 50);
  assert.equal(clampLeaderboardLimit(null), 100);
  assert.equal(clampLeaderboardLimit("abc"), 100);
  assert.equal(clampLeaderboardLimit(-5), 100);
});

test("buildRankedPointsSql ranks and pages in SQL (top-N + viewer, LIMIT N+1)", () => {
  const sql = buildRankedPointsSql({ kind: "top", topN: 20, userId: "me" }, null, true);
  assert.match(sql.text, /DENSE_RANK\(\) OVER/);
  assert.match(sql.text, /ROW_NUMBER\(\) OVER/);
  assert.match(sql.text, /WHERE rownum <= \$1::int OR user_id = \$2/);
  assert.match(sql.text, /LIMIT \$1::int \+ 1/);
  assert.deepEqual(sql.values, [20, "me"]);
});

test("buildRankedPointsSql: regional filter numbers params correctly; user-only query returns one row", () => {
  const top = buildRankedPointsSql({ kind: "top", topN: 10, userId: null }, "Delhi", true);
  assert.match(top.text, /AND u\.location = \$1/);
  assert.match(top.text, /WHERE rownum <= \$2::int\n/);
  assert.deepEqual(top.values, ["Delhi", 10]);
  const mine = buildRankedPointsSql({ kind: "user", userId: "me" }, null, false);
  assert.match(mine.text, /NULL::text AS location/);
  assert.match(mine.text, /WHERE user_id = \$1 LIMIT 1/);
  assert.deepEqual(mine.values, ["me"]);
});

test("getGlobalPointsLeaderboard sends the capped limit to SQL, not to JS", async () => {
  await withFakeUserPool([rawRow("a", 1, 900), rawRow("me", 2, 800)], async (queries) => {
    const result = await getGlobalPointsLeaderboard("me", null, 100_000);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].values, [1000, "me"]);
    assert.match(queries[0].text, /LIMIT/);
    assert.equal(result.myRank, 2);
    assert.equal(result.myPoints, 800);
  });
});

test("getTopPointsRows is viewer-agnostic; getPointsRowForUser fetches only the viewer", async () => {
  await withFakeUserPool([rawRow("a", 1, 900)], async (queries) => {
    const rows = await getTopPointsRows(50);
    assert.equal(rows.length, 1);
    assert.deepEqual(queries[0].values, [50]);
    assert.doesNotMatch(queries[0].text, /OR user_id/);
    const me = await getPointsRowForUser("a");
    assert.equal(me?.rank, 1);
    assert.deepEqual(queries[1].values, ["a"]);
  });
});

test("mergeTopWithViewer: fresh viewer row replaces a stale cached one in place, or is appended", () => {
  const top = [row("a", 1, 900), row("me", 2, 800), row("c", 3, 700)];
  const inPlace = mergeTopWithViewer(top, row("me", 2, 850), "me", 3);
  assert.deepEqual(inPlace.leaderboard.map((e) => e.userId), ["a", "me", "c"]);
  assert.equal(inPlace.myPoints, 850);
  const outside = mergeTopWithViewer([row("a", 1, 900), row("b", 2, 800)], row("me", 9, 5), "me", 2);
  assert.deepEqual(outside.leaderboard.map((e) => e.userId), ["a", "b", "me"]);
  assert.equal(outside.myRank, 9);
  const absent = mergeTopWithViewer(top, null, "me", 3);
  assert.equal(absent.myRank, 2, "cached row still resolves the rank when the my-row read misses");
});
