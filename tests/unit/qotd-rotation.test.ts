import test from "node:test";
import assert from "node:assert/strict";

import type { Subject } from "../../src/lib/entitlements";
import { subjectForDay } from "../../src/lib/qotd-rotation";

const P: Subject = "physics";
const C: Subject = "chemistry";
const M: Subject = "mathematics";
const B: Subject = "biology";

/** The subjects a cohort is shown on `days` consecutive days from day 0. */
function walk(cohort: readonly Subject[], days: number): (Subject | null)[] {
  return Array.from({ length: days }, (_, day) => subjectForDay(cohort, day));
}

test("a single-subject cohort always sees that subject", () => {
  assert.deepEqual(walk([P], 5), [P, P, P, P, P]);
  assert.deepEqual(walk([B], 3), [B, B, B]);
});

test("a pair alternates day by day", () => {
  assert.deepEqual(walk([P, C], 5), [P, C, P, C, P]);
});

test("a triplet cycles in three", () => {
  assert.deepEqual(walk([P, C, M], 7), [P, C, M, P, C, M, P]);
});

test("a quadruplet cycles in four", () => {
  assert.deepEqual(walk([P, C, M, B], 6), [P, C, M, B, P, C]);
});

test("a non-adjacent pair rotates too", () => {
  assert.deepEqual(walk([C, B], 4), [C, B, C, B]);
});

test("the rotation depends on the SET, not the caller's array order", () => {
  // Two callers holding the same access must agree on today's subject, however
  // they happened to build the array.
  for (const day of [0, 1, 2, 3, 17, 100]) {
    assert.equal(subjectForDay([B, P, M, C], day), subjectForDay([P, C, M, B], day));
    assert.equal(subjectForDay([C, P], day), subjectForDay([P, C], day));
  }
});

test("duplicates in the cohort do not stretch the rotation", () => {
  assert.deepEqual(walk([P, P, C] as Subject[], 4), [P, C, P, C]);
});

test("two students in the same cohort see the same subject every day", () => {
  const a: Subject[] = [P, M];
  const b: Subject[] = [M, P];
  for (let day = 0; day < 30; day += 1) {
    assert.equal(subjectForDay(a, day), subjectForDay(b, day), `day ${day}`);
  }
});

test("an empty cohort has no subject", () => {
  // A student starved by their study mode gets no card rather than a wrong one.
  assert.equal(subjectForDay([], 0), null);
  assert.equal(subjectForDay([], 12345), null);
});

test("gaining a subject changes the rotation from that day on", () => {
  const before: Subject[] = [P, C];
  const after: Subject[] = [P, C, B];
  assert.equal(subjectForDay(before, 2), P); // 2 % 2
  assert.equal(subjectForDay(after, 2), B); // 2 % 3, canonical order P,C,B
});

test("every subject in a cohort is reached within one full turn", () => {
  const cohort: Subject[] = [P, C, M, B];
  const seen = new Set(walk(cohort, cohort.length));
  assert.equal(seen.size, cohort.length);
});

test("a negative epoch day still yields a valid subject", () => {
  // Only reachable from a badly-skewed clock, but JS `%` returns a negative
  // index there and would read undefined off the array.
  assert.equal(subjectForDay([P, C], -1), C);
  assert.equal(subjectForDay([P, C, M], -4), M); // ((-4 % 3) + 3) % 3 === 2
});
