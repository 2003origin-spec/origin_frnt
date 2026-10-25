/**
 * Phase 8 (CBT) — sanitized-delivery + grading guards. Pure functions, so this
 * runs in test:unit without a database. The sanitization test is the security
 * gate: the student payload must never carry answers/explanations.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

// --- Bug fixes G2/G3 for the CBT local grader (docs/bug-fixes/03-grading-points.md) ---

test("G2: CBT numerical reads ONE strict number — fractions/scientific accepted, multi-number wrong", () => {
  const grade = (expected: string, submitted: string, tolerance: number | null = 0) =>
    gradeCbtLocal("numerical", { answerText: expected, tolerance } as CbtQuestionAnswer, { answerText: submitted }, 4, -1);
  // Used to grade as 3, 1 and 2 ("first number wins").
  assert.equal(grade("3", "3/4").marksAwarded, -1);
  assert.equal(grade("1", "1×10^-3").marksAwarded, -1);
  assert.equal(grade("2", "2 3").marksAwarded, -1);
  assert.equal(grade("2", "2 or 3").marksAwarded, -1);
  assert.equal(grade("2", "2,3").marksAwarded, -1);
  // The same notations now read as their real value.
  assert.equal(grade("0.75", "3/4").marksAwarded, 4);
  assert.equal(grade("0.001", "1×10^-3").marksAwarded, 4);
  assert.equal(grade("0.001", "1x10^-3").marksAwarded, 4);
  assert.equal(grade("0.001", "1E-3").marksAwarded, 4);
  assert.equal(grade("-5", "−5").marksAwarded, 4);
  assert.equal(grade("1000", "1,000").marksAwarded, 4);
  assert.equal(grade("100000", "1,00,000").marksAwarded, 4);
  // Plain numbers are unchanged.
  assert.equal(grade("42", "42").marksAwarded, 4);
  assert.equal(grade("9.8", "9.80").marksAwarded, 4);
  assert.equal(grade("-2500", "-2.5e3").marksAwarded, 4);
  assert.equal(grade("42", "41").marksAwarded, -1);
  assert.equal(grade("42", "").marksAwarded, 0);
  assert.equal(grade("42", "abc").marksAwarded, -1);
});

test("G2: CBT keeps its unit handling (label only) and its tolerance rule", () => {
  const units: CbtQuestionAnswer = { answerText: "9.8", units: "m/s^2", tolerance: 0 };
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8 m/s^2" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical_with_units", units, { answerText: "9.8 m/s^2 or 10 m/s^2" }, 4, -1).marksAwarded, -1);
  const farad: CbtQuestionAnswer = { answerText: "0.0015", units: "F", tolerance: 0 };
  assert.equal(gradeCbtLocal("numerical_with_units", farad, { answerText: "1.5×10^-3 F" }, 4, -1).marksAwarded, 4);
  // P6: no stored tolerance ⇒ the grader's rule, not 1%: an integer key is exact
  // and a decimal key is exact after rounding to the key's decimal places.
  const integerKey: CbtQuestionAnswer = { answerText: "250" };
  assert.equal(gradeCbtLocal("numerical", integerKey, { answerText: "250" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", integerKey, { answerText: "252" }, 4, -1).marksAwarded, -1);
  const decimalKey: CbtQuestionAnswer = { answerText: "9.80 m/s^2" };
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.8" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.804" }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("numerical", decimalKey, { answerText: "9.81" }, 4, -1).marksAwarded, -1);
  // Float noise at the tolerance edge no longer flips the result.
  assert.equal(gradeCbtLocal("numerical", { answerText: "9.8", tolerance: 0.1 }, { answerText: "9.9" }, 4, -1).marksAwarded, 4);
  // An unparseable answer key is held for review with no marks.
  const broken = gradeCbtLocal("numerical", { answerText: "about five" }, { answerText: "5" }, 4, -1);
  assert.deepEqual(broken, { marksAwarded: 0, isCorrect: false, needsReview: true });
});

test("G3: CBT matrix-match — every cell ticked is wrong; partial credit per complete row", () => {
  const answer = { matrixData: { rows: ["A", "B"], cols: ["1", "2"], correct_pairs: [[0, 1], [1, 0]] } } as CbtQuestionAnswer;
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[1, 0], [0, 1]] }, 4, -1).marksAwarded, 4);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 0], [0, 1], [1, 0], [1, 1]] }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 1]] }, 4, -1).marksAwarded, 2);
  assert.equal(gradeCbtLocal("matrix_match", answer, { matrixPairs: [[0, 1], [1, 1]] }, 4, -1).marksAwarded, -1);
  assert.equal(gradeCbtLocal("matrix_match", answer, {}, 4, -1).marksAwarded, 0);
  // M4 (P7): correct pairs only, no complete row ⇒ 0 (the grader's rule), never negative.
  const twoCells = { matrixData: { rows: ["A", "B"], cols: ["1", "2"], correct_pairs: [[0, 0], [0, 1], [1, 0]] } } as CbtQuestionAnswer;
  assert.equal(gradeCbtLocal("matrix_match", twoCells, { matrixPairs: [[0, 1]] }, 4, -1).marksAwarded, 0);
  assert.equal(gradeCbtLocal("matrix_match", twoCells, { matrixPairs: [[0, 1], [1, 1]] }, 4, -1).marksAwarded, -1);
});

// Shared grading-parity fixture (the file grader-service also runs): the parse
// table and every numeric/matrix case whose expectation does not depend on the
// G1 tolerance (P6): CBT uses the grader's rule — stored tolerance, else integer keys exact and
// decimal keys exact after rounding to the key's decimals.
type ParityCase = {
  id: string;
  question: { answerText?: string | null; tolerance?: number | null; matrixData?: Record<string, unknown> | null };
  answer: { answerText?: string | null; matrixPairs?: number[][] | null };
  expect: { isCorrect: boolean; marksAwarded: number; needsReview: boolean };
};
const parity = JSON.parse(readFileSync(new URL("../fixtures/grading-parity.json", import.meta.url), "utf8")) as {
  parseStrictNumber: [string | null, number | null][];
  cases: ParityCase[];
};

test("parity fixture: CBT number parsing matches parseStrictNumber's table", () => {
  for (const [raw, value] of parity.parseStrictNumber) {
    const graded = gradeCbtLocal("numerical", { answerText: String(value ?? 0), tolerance: 0 }, { answerText: raw }, 4, -1);
    assert.equal(graded.isCorrect, value !== null, `${JSON.stringify(raw)} → ${value}`);
  }
});

const CBT_PARITY_CASES: Record<string, "fixture"> = {
  "G1-tolerance-zero-is-exact": "fixture",
  "G1-explicit-0.1-accepts-9.75": "fixture",
  "G2-fraction-is-right": "fixture",
  "G2-times-ten-power-is-right": "fixture",
  "G2-upper-E-is-right": "fixture",
  "G2-two-numbers-is-wrong": "fixture",
  "G2-two-or-three-is-wrong": "fixture",
  "G2-expected-not-numeric-holds-for-review": "fixture",
  "G2-units-same-unit-is-right": "fixture",
  "G2-units-wrong-magnitude-is-wrong": "fixture",
  // CBT never compares units: a bare magnitude is compared with the key's (M1).
  "M1-units-bare-number-is-right": "fixture",
  // P6: a NULL tolerance follows the grader's integer / decimal-exact rule, not 1%.
  "G1-250-vs-252-is-wrong": "fixture",
  "G1-250-vs-250-is-right": "fixture",
  "G1-decimal-rounds-to-expected-places": "fixture",
  "G1-decimal-9.74-is-wrong": "fixture",
  "F7-fraction-key-three-decimals-is-right": "fixture",
  "F7-fraction-key-one-decimal-is-wrong": "fixture",
  "F7-terminating-fraction-key-rounded-is-wrong": "fixture",
  "F7-terminating-fraction-key-3-4-is-right": "fixture",
  // P7 / M4: correct pairs with no complete row are 0, not negative.
  "M4-one-correct-pair-no-complete-row-is-zero": "fixture",
  "G3-all-cells-ticked-is-negative": "fixture",
  "G3-one-row-complete-is-half": "fixture",
  "G3-subset-plus-wrong-pair-is-negative": "fixture",
  "G3-half-marked-row-earns-nothing-for-that-row": "fixture",
  "G3-exact-match": "fixture",
  "G3-unattempted": "fixture",
};

test("parity fixture: the applicable numeric + matrix cases grade the same in CBT", () => {
  const byId = new Map(parity.cases.map((c) => [c.id, c]));
  for (const id of Object.keys(CBT_PARITY_CASES)) {
    const c = byId.get(id);
    assert.ok(c, `fixture case ${id} exists`);
    const type = c.question.matrixData ? "matrix_match" : "numerical";
    const answer = {
      answerText: c.question.answerText ?? undefined,
      tolerance: c.question.tolerance ?? null,
      matrixData: c.question.matrixData ?? undefined,
    } as CbtQuestionAnswer;
    const out = gradeCbtLocal(type, answer, { answerText: c.answer.answerText, matrixPairs: c.answer.matrixPairs }, 4, -1);
    assert.equal(out.isCorrect, c.expect.isCorrect, `${id} isCorrect`);
    assert.equal(out.marksAwarded, c.expect.marksAwarded, `${id} marks`);
    assert.equal(out.needsReview, c.expect.needsReview, `${id} needsReview`);
  }
});
