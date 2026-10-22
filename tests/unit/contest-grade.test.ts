/**
 * Contest grading unit tests (Phase 4). The load-bearing property: every
 * position is classified exactly once, so correct+incorrect+unattempted ==
 * paper size, and the Contest Points config is applied.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { gradeContest, type GradableQuestion } from "@/lib/contest/grade";
import { DEFAULT_CONTEST_SCORING } from "@/lib/contest/contest-config";
import { isRecognisedKeyUnit } from "@/lib/assessments/parse-strict-number";

function mcq(position: number, correctOption: number, subject = "Physics"): GradableQuestion {
  return {
    position,
    questionId: `q${position}`,
    subject,
    questionType: "mcq",
    correctOption,
    correctOptions: null,
    answerText: null,
    tolerance: null,
    marks: null,
    negativeMarks: null,
  };
}

test("counts and score with +10/+2/0 default config", () => {
  const qs = [mcq(0, 1), mcq(1, 2), mcq(2, 0)];
  const answers = {
    "0": { selectedOption: 1 }, // correct → +10
    "1": { selectedOption: 3 }, // wrong (answered) → +2
    // position 2 unattempted → 0
  };
  const r = gradeContest(qs, answers, DEFAULT_CONTEST_SCORING);
  assert.equal(r.correct, 1);
  assert.equal(r.incorrect, 1);
  assert.equal(r.unattempted, 1);
  assert.equal(r.score, 12); // 10 + 2 + 0
});

test("count invariant holds for every answer combination", () => {
  const qs = Array.from({ length: 20 }, (_, i) => mcq(i, i % 4));
  // random-ish answers: some correct, some wrong, some blank
  const answers: Record<string, { selectedOption: number }> = {};
  for (let i = 0; i < 20; i += 1) {
    if (i % 3 === 0) continue; // blank
    answers[String(i)] = { selectedOption: i % 2 === 0 ? i % 4 : (i % 4 + 1) % 4 };
  }
  const r = gradeContest(qs, answers, DEFAULT_CONTEST_SCORING);
  assert.equal(r.correct + r.incorrect + r.unattempted, 20, "every position classified once");
  assert.equal(r.perQuestion.length, 20);
});

test("negative marking config penalizes wrong answers", () => {
  const qs = [mcq(0, 1), mcq(1, 1)];
  const r = gradeContest(
    qs,
    { "0": { selectedOption: 1 }, "1": { selectedOption: 0 } },
    { ...DEFAULT_CONTEST_SCORING, correctMarks: 4, incorrectMarks: -1 },
  );
  assert.equal(r.score, 3); // +4 correct, -1 wrong
});

test("per-question marks override the config", () => {
  const q: GradableQuestion = { ...mcq(0, 1), marks: 100, negativeMarks: -5 };
  const r = gradeContest([q], { "0": { selectedOption: 1 } }, DEFAULT_CONTEST_SCORING);
  assert.equal(r.score, 100);
});

test("section scores aggregate per subject", () => {
  const qs = [mcq(0, 1, "Physics"), mcq(1, 1, "Physics"), mcq(2, 1, "Chemistry")];
  const r = gradeContest(
    qs,
    { "0": { selectedOption: 1 }, "1": { selectedOption: 0 }, "2": { selectedOption: 1 } },
    DEFAULT_CONTEST_SCORING,
  );
  assert.equal(r.sectionScores.Physics.total, 2);
  assert.equal(r.sectionScores.Physics.correct, 1);
  assert.equal(r.sectionScores.Chemistry.correct, 1);
  // section score sum equals total score
  const sum = Object.values(r.sectionScores).reduce((a, s) => a + s.score, 0);
  assert.equal(Number(sum.toFixed(3)), r.score);
});

test("msq gives full marks only on an exact match", () => {
  const q: GradableQuestion = {
    position: 0,
    questionId: "q0",
    subject: "Physics",
    questionType: "msq",
    correctOption: null,
    correctOptions: [0, 2],
    answerText: null,
    tolerance: null,
    marks: null,
    negativeMarks: null,
  };
  assert.equal(gradeContest([q], { "0": { selectedOptions: [0, 2] } }, DEFAULT_CONTEST_SCORING).correct, 1);
  assert.equal(gradeContest([q], { "0": { selectedOptions: [0] } }, DEFAULT_CONTEST_SCORING).correct, 0);
});

// --- Bug fixes G1-G3 (docs/bug-fixes/03-grading-points.md) ------------------------

function numerical(
  position: number,
  answerText: string,
  tolerance: number | null = null,
  extra: Partial<GradableQuestion> = {},
): GradableQuestion {
  return { ...mcq(position, 0), questionType: "numerical", correctOption: null, answerText, tolerance, ...extra };
}

function isCorrect(q: GradableQuestion, answerText: string): boolean {
  return gradeContest([q], { [String(q.position)]: { answerText } }, DEFAULT_CONTEST_SCORING).perQuestion[0].isCorrect;
}

test("G1: no 1% default — 252 is wrong for 250, tolerance 0 is exact, teacher tolerance honoured", () => {
  assert.equal(isCorrect(numerical(0, "250"), "252"), false);
  assert.equal(isCorrect(numerical(0, "250"), "250"), true);
  assert.equal(isCorrect(numerical(0, "7", 0), "7.4"), false);
  assert.equal(isCorrect(numerical(0, "9.8"), "9.75"), true); // rounds to the stated 1 dp
  assert.equal(isCorrect(numerical(0, "9.8"), "9.74"), false);
  assert.equal(isCorrect(numerical(0, "9.8", 0.5), "9.4"), true);
  // The frozen answerSpec's tolerance wins; 0 means exact even when `tolerance` is looser.
  assert.equal(isCorrect(numerical(0, "9.8", 0.5, { answerSpec: { tolerance: 0 } }), "9.75"), false);
});

test("G2: strict parsing — fractions / scientific / thousands accepted, two numbers rejected", () => {
  assert.equal(isCorrect(numerical(0, "0.75"), "3/4"), true);
  assert.equal(isCorrect(numerical(0, "0.001"), "1×10^-3"), true);
  assert.equal(isCorrect(numerical(0, "0.001"), "1E-3"), true);
  assert.equal(isCorrect(numerical(0, "100000"), "1,00,000"), true);
  assert.equal(isCorrect(numerical(0, "2"), "2 3"), false);
  assert.equal(isCorrect(numerical(0, "2"), "2 or 3"), false);
  // firstNumber used to read "1×10^-3" as 1.
  assert.equal(isCorrect(numerical(0, "1"), "1×10^-3"), false);
});

test("G2: unit answers compare the magnitude; a different unit is wrong", () => {
  const q = numerical(0, "9.8 m/s^2", null, { questionType: "numerical_with_units" });
  assert.equal(isCorrect(q, "9.8 m/s^2"), true);
  assert.equal(isCorrect(q, "9.8"), true); // player: "include units if asked"
  assert.equal(isCorrect(q, "9.9 m/s^2"), false);
  assert.equal(isCorrect(q, "9.8 km/s^2"), false);
});

test("G3: matrix_match — ticking every cell is wrong and costs the negative mark", () => {
  const q: GradableQuestion = { ...mcq(0, 0), questionType: "matrix_match", correctOption: null, matrixData: [[0, 1], [1, 0]] };
  const scoring = { ...DEFAULT_CONTEST_SCORING, correctMarks: 4, incorrectMarks: -1 };
  const all = gradeContest([q], { "0": { matrixPairs: [[0, 0], [0, 1], [1, 0], [1, 1]] } }, scoring);
  assert.equal(all.correct, 0);
  assert.equal(all.incorrect, 1);
  assert.equal(all.score, -1);
  assert.equal(gradeContest([q], { "0": { matrixPairs: [[1, 0], [0, 1]] } }, scoring).score, 4);
  assert.equal(gradeContest([q], { "0": { matrixPairs: [[0, 1]] } }, scoring).score, -1); // no partial credit in contests
});

test("R3-5: key units with spaces / middle dots are units; prose is not (mirror of engine.py)", () => {
  for (const unit of ["m s^-1", "N m", "N·m", "kg·m/s²", "kg⋅m/s", "J mol^-1 K^-1", "g cm^-3", "Pa s", "m/s2", "cm²"]) {
    assert.equal(isRecognisedKeyUnit(unit), true, unit);
  }
  for (const unit of ["or 4", "cm or 20 mm", "to 6", "m and 5 s", "approx m", "x3", "x 3", "m 2", "(approx)"]) {
    assert.equal(isRecognisedKeyUnit(unit), false, unit);
  }
});
