/**
 * Approximate registered-count tests (in-memory fallback). Verifies record →
 * count, idempotency (same user counted once), per-contest isolation, and that
 * a fresh registration busts the read cache.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetContestCountsForTests,
  getApproxRegisteredCount,
  recordRegistration,
} from "@/server/contest/contest-counts";

test("counts distinct registrations per contest", async () => {
  __resetContestCountsForTests();
  await recordRegistration("c1", "u1");
  await recordRegistration("c1", "u2");
  await recordRegistration("c1", "u3");
  assert.equal(await getApproxRegisteredCount("c1"), 3);
});

test("recording the same user twice counts once (idempotent)", async () => {
  __resetContestCountsForTests();
  await recordRegistration("c1", "u1");
  await recordRegistration("c1", "u1");
  assert.equal(await getApproxRegisteredCount("c1"), 1);
});

test("counts are isolated per contest", async () => {
  __resetContestCountsForTests();
  await recordRegistration("c1", "u1");
  await recordRegistration("c2", "u1");
  await recordRegistration("c2", "u2");
  assert.equal(await getApproxRegisteredCount("c1"), 1);
  assert.equal(await getApproxRegisteredCount("c2"), 2);
  assert.equal(await getApproxRegisteredCount("c3"), 0);
});

test("a new registration busts the read cache", async () => {
  __resetContestCountsForTests();
  await recordRegistration("c1", "u1");
  assert.equal(await getApproxRegisteredCount("c1"), 1); // caches 1
  await recordRegistration("c1", "u2"); // must invalidate the cache
  assert.equal(await getApproxRegisteredCount("c1"), 2);
});
