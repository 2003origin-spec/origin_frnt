import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPointsLeaderboardResult,
  type RankedPointsRow,
} from "../../src/server/leaderboard-points";

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
