/**
 * Contest Prep Score + Accuracy aggregation unit tests (Phase 2c).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  PRACTICE_TARGET_PER_SUBJECT,
  computePracticeMetrics,
} from "@/lib/contest/practice-score";

const SUBJECTS = ["Physics", "Chemistry", "Mathematics"];

test("no practice → zero everywhere", () => {
  const m = computePracticeMetrics(SUBJECTS, {});
  assert.equal(m.prepScore, 0);
  assert.equal(m.accuracy, 0);
  assert.equal(m.attempted, 0);
  assert.equal(m.perSubject.length, 3);
});

test("overall accuracy is correct/attempted across subjects", () => {
  const m = computePracticeMetrics(SUBJECTS, {
    Physics: { attempted: 10, correct: 8 },
    Chemistry: { attempted: 10, correct: 2 },
  });
  // 10/20 correct = 50%
  assert.equal(m.attempted, 20);
  assert.equal(m.correct, 10);
  assert.equal(m.accuracy, 50);
});

test("full prep requires coverage AND accuracy in EVERY subject", () => {
  const target = PRACTICE_TARGET_PER_SUBJECT;
  // all subjects fully covered + 100% accurate → prep 100
  const perfect = Object.fromEntries(
    SUBJECTS.map((s) => [s, { attempted: target, correct: target }]),
  );
  assert.equal(computePracticeMetrics(SUBJECTS, perfect).prepScore, 100);

  // one subject untouched → prep drops (that subject contributes 0 readiness)
  const twoOfThree = { ...perfect, Mathematics: { attempted: 0, correct: 0 } };
  const m = computePracticeMetrics(SUBJECTS, twoOfThree);
  // (1 + 1 + 0) / 3 = 0.667 → 67
  assert.equal(m.prepScore, 67);
});

test("coverage is capped at the target (over-practice doesn't exceed 1)", () => {
  const target = PRACTICE_TARGET_PER_SUBJECT;
  const over = Object.fromEntries(
    SUBJECTS.map((s) => [s, { attempted: target * 5, correct: target * 5 }]),
  );
  assert.equal(computePracticeMetrics(SUBJECTS, over).prepScore, 100);
});

test("partial coverage scales readiness linearly", () => {
  const target = PRACTICE_TARGET_PER_SUBJECT;
  // half-covered, fully accurate, single subject → readiness 0.5 → prep 50
  const m = computePracticeMetrics(["Physics"], {
    Physics: { attempted: target / 2, correct: target / 2 },
  });
  assert.equal(m.prepScore, 50);
});

test("garbage tallies are coerced safely", () => {
  const m = computePracticeMetrics(["Physics"], {
    Physics: { attempted: "x", correct: -3 },
  });
  assert.equal(m.attempted, 0);
  assert.equal(m.prepScore, 0);
});

test("empty subject list falls back to the tally keys", () => {
  const m = computePracticeMetrics([], { Physics: { attempted: 20, correct: 20 } });
  assert.equal(m.perSubject.length, 1);
  assert.equal(m.prepScore, 100);
});
