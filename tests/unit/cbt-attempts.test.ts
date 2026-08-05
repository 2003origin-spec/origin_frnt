/**
 * Phase 8 (CBT) — sanitized-delivery + grading guards. Pure functions, so this
 * runs in test:unit without a database. The sanitization test is the security
 * gate: the student payload must never carry answers/explanations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { gradeCbtLocal, sanitizeQuestionForStudent, type TestQuestionRow } from "@/server/cbt/cbt-attempts-service";
import type { CbtQuestionAnswer } from "@/lib/cbt/question-model";

const FORBIDDEN_KEYS = [
  "answer",
  "answerText",
  "answer_text",
  "correctOption",
  "correct_option",
  "correctOptions",
  "correct_options",
  "correct_pairs",
  "correctPairs",
  "explanation",
  "tolerance",
];

function deepScanForForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...deepScanForForbiddenKeys(v, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(key)) hits.push(`${path}.${key}`);
      hits.push(...deepScanForForbiddenKeys(v, `${path}.${key}`));
    }
  }
  return hits;
}

function makeQuestion(over: Partial<TestQuestionRow>): TestQuestionRow {
  return {
    position: 1,
    questionId: "cbtq_1",
    questionType: "mcq",
    stem: "What is 2 + 2?",
    image: null,
    options: [{ text: "3" }, { text: "4" }, { text: "5" }],
    answer: { correctOption: 1, explanation: "obvious" } as CbtQuestionAnswer,
    explanation: "because arithmetic",
    subject: "Mathematics",
    chapter: "Basics",
    marks: 4,
    negativeMarks: -1,
    ...over,
  };
}

test("Phase 8: sanitized MCQ payload deep-scans clean of forbidden keys", () => {
  const out = sanitizeQuestionForStudent(makeQuestion({}));
  const hits = deepScanForForbiddenKeys(out);
  assert.deepEqual(hits, [], `sanitized payload leaked: ${hits.join(", ")}`);
  assert.deepEqual(out.options, [
    { text: "3", image: null },
    { text: "4", image: null },
    { text: "5", image: null },
  ]);
  assert.equal(out.marks, 4);
});

test("sanitized options carry per-option images through to the student", () => {
  const out = sanitizeQuestionForStudent(
    makeQuestion({ options: [{ text: "A", image: "https://cdn/o1.png" }, { text: "", image: "https://cdn/o2.png" }] }),
  );
  assert.deepEqual(out.options, [
    { text: "A", image: "https://cdn/o1.png" },
    { text: "", image: "https://cdn/o2.png" },
  ]);
});

test("Phase 8: sanitized matrix_match strips correct_pairs but keeps display rows", () => {
  const q = makeQuestion({
    questionType: "matrix_match",
    answer: {
      matrixData: { rows: ["A", "B"], columns: ["P", "Q"], correct_pairs: [[0, 1]] },
    } as CbtQuestionAnswer,
  });
  const out = sanitizeQuestionForStudent(q);
  const hits = deepScanForForbiddenKeys(out);
  assert.deepEqual(hits, [], `matrix leaked: ${hits.join(", ")}`);
  assert.ok(out.matrixData, "matrix display data present");
  assert.deepEqual(out.matrixData?.rows, ["A", "B"]);
  assert.equal((out.matrixData as Record<string, unknown>).correct_pairs, undefined);
});

test("Phase 8: MCQ grading — correct/incorrect/unattempted scoring", () => {
  const answer: CbtQuestionAnswer = { correctOption: 1 };
  assert.equal(gradeCbtLocal("mcq", answer, { selectedOption: 1 }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("mcq", answer, { selectedOption: 0 }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("mcq", answer, {}, 4, -1).marksAwarded, 0);
});

test("Phase 8: MSQ partial credit + numerical tolerance", () => {
  const msq: CbtQuestionAnswer = { correctOptions: [0, 1, 2] };
  assert.equal(gradeCbtLocal("msq", msq, { selectedOptions: [0, 1, 2] }, 4, -1).marksAwarded, 4);
  // subset → partial credit (2/3 * 4)
  const partial = gradeCbtLocal("msq", msq, { selectedOptions: [0, 1] }, 4, -1);
  assert.ok(partial.marksAwarded > 0 && partial.marksAwarded < 4);
  // superset (wrong option) → not a subset → negative
  assert.equal(gradeCbtLocal("msq", msq, { selectedOptions: [0, 3] }, 4, -1).marksAwarded, -1);

  const num: CbtQuestionAnswer = { answerText: "9.8", tolerance: 0.1 };
  assert.equal(gradeCbtLocal("numerical", num, { answerText: "9.85" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", num, { answerText: "12" }, 4, -1).marksAwarded, -1);
});

test("Phase 8: subjective is flagged for review, never auto-scored", () => {
  const out = gradeCbtLocal("subjective", { answerText: "an essay" } as CbtQuestionAnswer, { answerText: "my essay" }, 4, 0);
  assert.equal(out.marksAwarded, 0);
  assert.equal(out.needsReview, true);
});
