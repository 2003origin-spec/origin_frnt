import test from "node:test";
import assert from "node:assert/strict";

import { calculateTimedPracticeScore } from "../../src/server/gamification";

// Locks the OG-Code "Base × Speed + 5" rule shown in the student scoring modal.
// Worked example from the modal: one HARD question (base 50) →
//   Fast (×1.35) = 73 · On time (×1.0) = 55 · Slow (×0.55) = 33.

test("hard question, solved fast (<= 1/2 target), earns the full 73", () => {
  // Hard target = 180s; <= 90s counts as "fast" (ratio <= 0.5 → 1.35×).
  const score = calculateTimedPracticeScore("hard", 60, { isCorrect: true });
  assert.equal(score.speedMultiplier, 1.35);
  assert.equal(score.resultScore, 73);
  assert.equal(score.pointsAwarded, 73);
  assert.equal(score.basePoints, 50);
  assert.equal(score.targetTimeSeconds, 180);
});

test("hard question, solved on time, earns 55", () => {
  const score = calculateTimedPracticeScore("hard", 180, { isCorrect: true });
  assert.equal(score.speedMultiplier, 1);
  assert.equal(score.resultScore, 55);
});

test("hard question, solved slow (> 1.75x target), earns 33", () => {
  const score = calculateTimedPracticeScore("hard", 400, { isCorrect: true });
  assert.equal(score.speedMultiplier, 0.55);
  assert.equal(score.resultScore, 33);
});

test("wrong answer scores 0 and awards 0", () => {
  const score = calculateTimedPracticeScore("hard", 60, { isCorrect: false });
  assert.equal(score.resultScore, 0);
  assert.equal(score.pointsAwarded, 0);
});

test("already-solved re-solve keeps its result score but awards no new points", () => {
  const score = calculateTimedPracticeScore("hard", 60, { isCorrect: true, alreadySolved: true });
  assert.equal(score.resultScore, 73);
  assert.equal(score.pointsAwarded, 0);
});

test("base values and targets per difficulty match the modal", () => {
  const cases: Array<[string, number, number]> = [
    ["easy", 10, 45],
    ["medium", 25, 90],
    ["hard", 50, 180],
    ["insane", 100, 300],
  ];
  for (const [difficulty, base, target] of cases) {
    const onTime = calculateTimedPracticeScore(difficulty, target, { isCorrect: true });
    assert.equal(onTime.basePoints, base, `${difficulty} base`);
    assert.equal(onTime.targetTimeSeconds, target, `${difficulty} target`);
    // On-time (×1.0) → base + 5.
    assert.equal(onTime.resultScore, base + 5, `${difficulty} on-time score`);
  }
});

test("a correct answer never scores below the 5-point floor", () => {
  for (const difficulty of ["easy", "medium", "hard", "insane"]) {
    const slow = calculateTimedPracticeScore(difficulty, 100_000, { isCorrect: true });
    assert.ok(slow.resultScore >= 5, `${difficulty} floor`);
  }
});

test("speed multiplier stays within the 0.55x–1.35x band", () => {
  for (const seconds of [1, 30, 90, 180, 400, 5000]) {
    const score = calculateTimedPracticeScore("medium", seconds, { isCorrect: true });
    assert.ok(score.speedMultiplier >= 0.55 && score.speedMultiplier <= 1.35, `t=${seconds}`);
  }
});
