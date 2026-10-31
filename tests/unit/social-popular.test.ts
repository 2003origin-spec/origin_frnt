import test from "node:test";
import assert from "node:assert/strict";

import type { AppStore } from "../../src/server/store";
import {
  buildPopularBoards,
  getCachedGlobalRanking,
  getPopularStudents,
  SOCIAL_RANK_TTL_MS,
  type PopularStudents,
} from "../../src/server/social/social-service";

function makeStore(userCount: number): AppStore {
  const users = Array.from({ length: userCount }, (_, i) => ({
    id: `u${i}`,
    username: `user${i}`,
    name: `User ${i}`,
    role: "student",
    avatar: null,
    streak: 0,
  }));
  const practiceAttempts = users.flatMap((u, i) =>
    Array.from({ length: i % 5 }, (_, j) => ({
      userId: u.id,
      questionId: `q${j}`,
      isCorrect: true,
      createdAt: new Date(0).toISOString(),
    })),
  );
  const userScores = users.map((u, i) => ({ userId: u.id, totalPoints: i * 10 }));
  return { users, practiceAttempts, testResults: [], userScores } as unknown as AppStore;
}

test("buildPopularBoards resolves points by id and keeps perTab + 1 cards per tab", () => {
  const store = makeStore(60);
  const boards = buildPopularBoards(store, new Map([["u7", 3]]), 24, Date.now());
  assert.equal(boards.ranked.length, 25);
  assert.equal(boards.followed.length, 25);
  assert.equal(boards.followed[0].id, "u7", "most-followed first");
  for (const card of boards.ranked) {
    const idx = Number(card.id.slice(1));
    assert.equal(card.points, idx * 10);
  }
});

test("buildPopularBoards scales linearly: 5k users finish well under a second", () => {
  const store = makeStore(5000);
  const started = performance.now();
  buildPopularBoards(store, new Map(), 24, Date.now());
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 1000, `took ${elapsed.toFixed(0)} ms`);
});

test("getPopularStudents drops the viewer from (shared, cached) boards without mutating them", async () => {
  const store = makeStore(30);
  const boards = buildPopularBoards(store, new Map(), 5, Date.now());
  const frozen = JSON.stringify(boards);
  const viewerId = boards.ranked[0].id;
  let loads = 0;
  const loader = async (): Promise<PopularStudents> => {
    loads += 1;
    return boards;
  };
  const result = await getPopularStudents(viewerId, 5, loader);
  assert.equal(loads, 1);
  assert.equal(result.ranked.length, 5);
  assert.ok(result.ranked.every((c) => c.id !== viewerId));
  assert.equal(JSON.stringify(boards), frozen, "cached boards untouched");
});

test("getCachedGlobalRanking reuses one ranking across store objects within the TTL", () => {
  (globalThis as { __originSocialRankCache?: unknown }).__originSocialRankCache = undefined;
  const t0 = 10_000_000;
  const first = getCachedGlobalRanking(makeStore(10), t0);
  // A write swaps in a fresh store object — still served from the cache.
  const second = getCachedGlobalRanking(makeStore(10), t0 + 1000);
  assert.equal(second, first);
  const third = getCachedGlobalRanking(makeStore(10), t0 + SOCIAL_RANK_TTL_MS + 1);
  assert.notEqual(third, first, "recomputed after the TTL");
  assert.equal(third.rankByUser.get("u4"), 1);
});
