import test from "node:test";
import assert from "node:assert/strict";

import {
  pickDailyChallengeId,
  type DailyChallengeCandidate,
} from "../../src/server/ogcode-catalog";

const NONE: ReadonlySet<string> = new Set<string>();

function pool(...ids: string[]): DailyChallengeCandidate[] {
  return ids.map((id, index) => ({ id, sourceIndex: index, isCurated: false }));
}

test("returns null for an empty pool", () => {
  assert.equal(pickDailyChallengeId([], NONE, 100), null);
});

test("rotates across the full pool as the day advances (the core bug fix)", () => {
  const eligible = pool("a", "b", "c", "d");
  const picks = [0, 1, 2, 3, 4, 5].map((day) => pickDailyChallengeId(eligible, NONE, day));
  // Deterministic epochDay % count over a stable order → walks every question,
  // never stuck on one. (Old code did epochDay % curatedCount = always index 0
  // when a single row was flagged.)
  assert.deepEqual(picks, ["a", "b", "c", "d", "a", "b"]);
});

test("is stable for a given day", () => {
  const eligible = pool("a", "b", "c");
  assert.equal(pickDailyChallengeId(eligible, NONE, 42), pickDailyChallengeId(eligible, NONE, 42));
});

test("excludes questions used within the no-repeat window", () => {
  const eligible = pool("a", "b", "c", "d");
  // Day 4 would normally pick "a" (4 % 4 = 0); exclude it → picks from {b,c,d}.
  const chosen = pickDailyChallengeId(eligible, new Set(["a"]), 4);
  assert.notEqual(chosen, "a");
  assert.ok(["b", "c", "d"].includes(chosen!));
});

test("allows repeats only once the window exhausts the whole pool", () => {
  const eligible = pool("a", "b");
  // Both used → exclusion relaxes rather than returning null.
  const chosen = pickDailyChallengeId(eligible, new Set(["a", "b"]), 3);
  assert.ok(["a", "b"].includes(chosen!));
});

test("prefers curated questions without collapsing the pool to one", () => {
  const eligible: DailyChallengeCandidate[] = [
    { id: "plain-1", sourceIndex: 0, isCurated: false },
    { id: "curated-x", sourceIndex: 1, isCurated: true },
    { id: "curated-y", sourceIndex: 2, isCurated: true },
    { id: "plain-2", sourceIndex: 3, isCurated: false },
  ];
  // With two curated rows eligible, picks stay within the curated set and still
  // rotate between them across days — not pinned to a single question.
  const day0 = pickDailyChallengeId(eligible, NONE, 0);
  const day1 = pickDailyChallengeId(eligible, NONE, 1);
  assert.ok(["curated-x", "curated-y"].includes(day0!));
  assert.ok(["curated-x", "curated-y"].includes(day1!));
  assert.notEqual(day0, day1);
});

test("falls back to the broad pool when curated rows are all used up", () => {
  const eligible: DailyChallengeCandidate[] = [
    { id: "curated-x", sourceIndex: 0, isCurated: true },
    { id: "plain-1", sourceIndex: 1, isCurated: false },
    { id: "plain-2", sourceIndex: 2, isCurated: false },
  ];
  // The one curated row is inside the no-repeat window → selection uses the
  // remaining plain questions instead of re-showing the curated one.
  const chosen = pickDailyChallengeId(eligible, new Set(["curated-x"]), 5);
  assert.ok(["plain-1", "plain-2"].includes(chosen!));
});
