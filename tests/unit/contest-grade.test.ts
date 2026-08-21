/**
 * Contest grading unit tests (Phase 4). The load-bearing property: every
 * position is classified exactly once, so correct+incorrect+unattempted ==
 * paper size, and the Contest Points config is applied.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { gradeContest, type GradableQuestion } from "@/lib/contest/grade";
import { DEFAULT_CONTEST_SCORING } from "@/lib/contest/contest-config";

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
