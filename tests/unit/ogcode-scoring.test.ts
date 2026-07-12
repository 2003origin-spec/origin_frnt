/**
 * OGCode Scoring V2 — computeOgcodeScore() unit tests
 * (V1/OGCODE_SCORING_ALGORITHM.md, Phase 2). Pure function; no DB.
 *
 * Fixtures come straight from the §3 difficulty table:
 *   easy 5/30 · medium 15/60 · hard 30/100 · insane 50/120
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  OGCODE_ATTEMPT_CAPS,
  OGCODE_BASE_SCORING,
  computeOgcodeScore,
  isSingleAttemptType,
  type OgcodeScoreInput,
} from "@/server/ogcode-scoring";

function base(overrides: Partial<OgcodeScoreInput>): OgcodeScoreInput {
  return {
    questionType: "mcq",
    difficulty: "medium",
    isCorrect: true,
    timeSpentSeconds: 60,
    totalAttempts: 1,
    hintRevealed: false,
    answerRevealed: false,
    attemptedBeforeSession: false,
    ...overrides,
  };
}

test("difficulty table matches the plan (§3)", () => {
  assert.deepEqual(OGCODE_BASE_SCORING.easy, { bs: 5, bt: 30 });
  assert.deepEqual(OGCODE_BASE_SCORING.medium, { bs: 15, bt: 60 });
  assert.deepEqual(OGCODE_BASE_SCORING.hard, { bs: 30, bt: 100 });
  assert.deepEqual(OGCODE_BASE_SCORING.insane, { bs: 50, bt: 120 });
});

test("attempt caps: MCQ 3, Numerical/Range 4, others single-attempt", () => {
  assert.equal(OGCODE_ATTEMPT_CAPS.mcq, 3);
  assert.equal(OGCODE_ATTEMPT_CAPS.numerical, 4);
  assert.equal(OGCODE_ATTEMPT_CAPS.range, 4);
  assert.equal(isSingleAttemptType("msq"), true);
  assert.equal(isSingleAttemptType("matrix_match"), true);
  assert.equal(isSingleAttemptType("subjective"), true);
  assert.equal(isSingleAttemptType("mcq"), false);
  assert.equal(isSingleAttemptType("range"), false);
});

test("already-attempted question short-circuits to 0 (rule 1)", () => {
  const result = computeOgcodeScore(base({ attemptedBeforeSession: true, timeSpentSeconds: 5 }));
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, ["already_attempted"]);
});

test("first-try correct at exactly base time earns full bs", () => {
  const result = computeOgcodeScore(base({}));
  assert.equal(result.score, 15);
  assert.equal(result.maxScore, 15);
});

test("fast answers clamp at full bs — never a >1 multiplier", () => {
  const result = computeOgcodeScore(base({ timeSpentSeconds: 6 }));
  assert.equal(result.score, 15);
});

test("tt = 0 guard: instant submission does not divide by zero", () => {
  const result = computeOgcodeScore(base({ timeSpentSeconds: 0 }));
  assert.equal(result.score, 15);
  assert.equal(Number.isFinite(result.score), true);
});

test("slow answers decay: medium at 120s earns half bs", () => {
  const result = computeOgcodeScore(base({ timeSpentSeconds: 120 }));
  assert.equal(result.score, 7.5);
});

test("MCQ third-attempt correct divides by 3", () => {
  const result = computeOgcodeScore(base({ totalAttempts: 3 }));
  assert.equal(result.score, 5);
  assert.ok(result.reasons.includes("attempt_divisor:3"));
});

test("range fourth-attempt correct divides by 4 (hard: 30 → 7.5)", () => {
  const result = computeOgcodeScore(
    base({ questionType: "range", difficulty: "hard", timeSpentSeconds: 100, totalAttempts: 4 }),
  );
  assert.equal(result.score, 7.5);
});

test("wrong terminal outcome (cap exhausted) scores 0", () => {
  const result = computeOgcodeScore(base({ isCorrect: false, totalAttempts: 3 }));
  assert.equal(result.score, 0);
  assert.ok(result.reasons.includes("incorrect"));
});

test("hint reveal halves the base for the numeric family", () => {
  const result = computeOgcodeScore(base({ hintRevealed: true }));
  assert.equal(result.score, 7.5);
  assert.ok(result.reasons.includes("hint_decay"));
});

test("answer reveal zeroes everything, even a correct fast solve", () => {
  const result = computeOgcodeScore(base({ answerRevealed: true, timeSpentSeconds: 5 }));
  assert.equal(result.score, 0);
  assert.ok(result.reasons.includes("answer_reveal_zero"));
});

test("subjective: flat bs when correct, ignoring time entirely", () => {
  const result = computeOgcodeScore(
    base({ questionType: "subjective", difficulty: "insane", timeSpentSeconds: 9999 }),
  );
  assert.equal(result.score, 50);
  assert.ok(result.reasons.includes("subjective_flat"));
});

test("subjective: 0 when incorrect", () => {
  const result = computeOgcodeScore(base({ questionType: "subjective", isCorrect: false }));
  assert.equal(result.score, 0);
});

test("MSQ full: all correct chosen, no wrong → bs regardless of time/attempts", () => {
  const result = computeOgcodeScore(
    base({
      questionType: "msq",
      timeSpentSeconds: 500,
      msq: { totalCorrectOptions: 2, correctChosen: 2, wrongChosen: 0 },
    }),
  );
  assert.equal(result.score, 15);
  assert.ok(result.reasons.includes("jee_full"));
});

test("MSQ partial: JEE +1-per-correct tiers scale as 0.25·bs each", () => {
  const three = computeOgcodeScore(
    base({ questionType: "msq", msq: { totalCorrectOptions: 4, correctChosen: 3, wrongChosen: 0 } }),
  );
  assert.equal(three.score, 11.25); // 0.75 × 15
  const one = computeOgcodeScore(
    base({ questionType: "msq", msq: { totalCorrectOptions: 3, correctChosen: 1, wrongChosen: 0 } }),
  );
  assert.equal(one.score, 3.75); // 0.25 × 15
});

test("MSQ blank scores 0", () => {
  const result = computeOgcodeScore(
    base({ questionType: "msq", msq: { totalCorrectOptions: 2, correctChosen: 0, wrongChosen: 0 } }),
  );
  assert.equal(result.score, 0);
  assert.ok(result.reasons.includes("jee_blank"));
});

test("MSQ any wrong pick goes NEGATIVE: −0.5·bs", () => {
  const result = computeOgcodeScore(
    base({
      questionType: "msq",
      msq: { totalCorrectOptions: 3, correctChosen: 2, wrongChosen: 1 },
    }),
  );
  assert.equal(result.score, -7.5);
  assert.ok(result.reasons.includes("jee_wrong_pick_penalty"));
});

test("hint + wrong MSQ compose proportionally: −0.5 × (bs/2) = −bs/4", () => {
  const result = computeOgcodeScore(
    base({
      questionType: "msq",
      hintRevealed: true,
      msq: { totalCorrectOptions: 2, correctChosen: 1, wrongChosen: 1 },
    }),
  );
  assert.equal(result.score, -3.75); // −15/4
});

test("matrix match: full, partial, blank, wrong-row penalty", () => {
  const full = computeOgcodeScore(
    base({ questionType: "matrix_match", matrix: { totalRows: 4, correctRows: 4, wrongRows: 0 } }),
  );
  assert.equal(full.score, 15);

  const partial = computeOgcodeScore(
    base({ questionType: "matrix_match", matrix: { totalRows: 4, correctRows: 3, wrongRows: 0 } }),
  );
  assert.equal(partial.score, 11.25); // (3/4) × 15

  const blank = computeOgcodeScore(
    base({ questionType: "matrix_match", matrix: { totalRows: 4, correctRows: 0, wrongRows: 0 } }),
  );
  assert.equal(blank.score, 0);

  const wrong = computeOgcodeScore(
    base({ questionType: "matrix_match", matrix: { totalRows: 4, correctRows: 3, wrongRows: 1 } }),
  );
  assert.equal(wrong.score, -7.5);
});

test("scores round to 2 decimals at the end", () => {
  // easy (bs 5, bt 30), 45s, attempt 1 → (30/45)·5 = 3.333… → 3.33
  const result = computeOgcodeScore(
    base({ difficulty: "easy", timeSpentSeconds: 45 }),
  );
  assert.equal(result.score, 3.33);
});

test("answer reveal also nullifies the MSQ wrong-pick penalty (−0.5 × 0)", () => {
  const result = computeOgcodeScore(
    base({
      questionType: "msq",
      answerRevealed: true,
      msq: { totalCorrectOptions: 2, correctChosen: 0, wrongChosen: 2 },
    }),
  );
  assert.equal(result.score, -0);
  assert.equal(Math.abs(result.score), 0);
});
