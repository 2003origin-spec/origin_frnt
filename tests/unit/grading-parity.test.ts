/**
 * Bug fixes G1-G4 (V1/docs/bug-fixes/03-grading-points.md).
 *
 * Runs tests/fixtures/grading-parity.json — the SAME file grader-service's
 * tests/test_grading_parity.py runs through the authoritative Python engine —
 * through every TS copy of the grading logic: the shared helpers in
 * src/lib/assessments, the local fallback `gradeAnswer` in legacy/assessments.ts
 * (+ `computeMarksFromCredit` in assessment-orchestrator.ts) and the contest
 * copy in lib/contest/grade.ts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseStrictNumber, splitMagnitudeAndUnit } from "@/lib/assessments/parse-strict-number";
import { numbersMatch, resolveNumericTolerance } from "@/lib/assessments/numeric-tolerance";
import { gradeMatrixPairs } from "@/lib/assessments/matrix-grade";
import { gradeNumericText, roundHalfUp } from "@/lib/assessments/numeric-tolerance";
import { isNoPenalty, isReviewHold, NO_PENALTY_REASONS } from "@/lib/assessments/review-hold";
import { semanticBand, semanticCreditAwarded } from "@/lib/assessments/semantic-credit";
import { gradeAnswer } from "@/legacy/assessments";
import { computeMarksFromCredit } from "@/server/assessment-orchestrator";
import { gradeContest, type GradableQuestion } from "@/lib/contest/grade";
import { DEFAULT_CONTEST_SCORING } from "@/lib/contest/contest-config";
import type { GraderScoringPolicy } from "@/server/grader-client";
import type { StoredQuestion, StoredUserAnswer } from "@/server/store";
import { buildCbtGraderItem, gradeCbtLocal, type TestQuestionRow } from "@/server/cbt/cbt-attempts-service";

type FixtureQuestion = {
  questionType: StoredQuestion["questionType"];
  answerText?: string | null;
  tolerance?: number | null;
  correctOption?: number | null;
  correctOptions?: number[] | null;
  matrixData?: { column_a: string[]; column_b: string[]; correct_pairs: number[][] } | null;
  answerSpec?: NonNullable<StoredQuestion["answerSpec"]> | null;
};

type FixtureAnswer = {
  answerText?: string | null;
  selectedOption?: number | null;
  selectedOptions?: number[] | null;
  matrixPairs?: number[][] | null;
};

type FixtureCase = {
  id: string;
  pythonOnly?: boolean;
  /** lib/contest/grade.ts deliberately differs (bare magnitude accepted for unit answers). */
  contestIsCorrect?: boolean;
  question: FixtureQuestion;
  answer: FixtureAnswer;
  expect: {
    isCorrect: boolean;
    creditAwarded: number;
    marksAwarded: number;
    needsReview: boolean;
    reasonCodes?: string[];
  };
};

type Fixture = {
  policy: GraderScoringPolicy;
  parseStrictNumber: [string | null, number | null][];
  numericTolerance: {
    id: string;
    expected: string;
    submitted: string;
    tolerance: number | null;
    answerSpecTolerance: number | null;
    kind: "explicit" | "integer_exact" | "decimal_exact";
    match: boolean;
  }[];
  matrix: {
    id: string;
    expected: number[][];
    submitted: number[][];
    partialCreditPolicy: "fractional" | "none";
    isCorrect: boolean;
    credit: number;
    marks: number;
    reason: string;
  }[];
  semanticCredit: { score: number; threshold: number; isCorrect: boolean; credit: number }[];
  cases: FixtureCase[];
};

const fixture = JSON.parse(readFileSync(new URL("../fixtures/grading-parity.json", import.meta.url), "utf8")) as Fixture;

function storedQuestion(id: string, data: FixtureQuestion): StoredQuestion {
  return {
    id,
    text: id,
    options: null,
    correctOption: data.correctOption ?? null,
    correctOptions: data.correctOptions ?? null,
    answerText: data.answerText ?? null,
    tolerance: data.tolerance ?? null,
    matrixData: data.matrixData ?? null,
    explanation: "",
    hint: null,
    answerSpec: data.answerSpec ?? null,
    subject: "Physics",
    chapter: "Units",
    concept: "Measurement",
    difficulty: "medium",
    image: null,
    tags: null,
    questionType: data.questionType,
    acceptanceRate: 0,
    totalCorrect: 0,
    frequency: 0,
    isChallengeOfTheDay: false,
  };
}

function storedAnswer(id: string, data: FixtureAnswer): StoredUserAnswer {
  return {
    questionId: id,
    selectedOption: data.selectedOption ?? null,
    selectedOptions: data.selectedOptions ?? null,
    matrixPairs: data.matrixPairs ?? null,
    answerText: data.answerText ?? null,
    timeSpent: 0,
    isMarkedForReview: false,
  };
}

function answered(data: FixtureAnswer): boolean {
  return (
    typeof data.selectedOption === "number" ||
    (data.selectedOptions?.length ?? 0) > 0 ||
    (data.matrixPairs?.length ?? 0) > 0 ||
    Boolean(data.answerText?.trim())
  );
}

const CONTEST_TYPES = new Set(["mcq", "msq", "numerical", "matrix_match"]);

function contestQuestion(id: string, data: FixtureQuestion): GradableQuestion {
  return {
    position: 0,
    questionId: id,
    subject: "Physics",
    questionType: data.questionType,
    correctOption: data.correctOption ?? null,
    correctOptions: data.correctOptions ?? null,
    answerText: data.answerSpec?.expectedValue ?? data.answerText ?? null,
    tolerance: data.answerSpec?.tolerance ?? data.tolerance ?? null,
    matrixData: data.matrixData?.correct_pairs ?? null,
    marks: null,
    negativeMarks: null,
  };
}

// --- G2: strict number parser ------------------------------------------------------

test("parseStrictNumber matches the Python parse_strict_number table", () => {
  for (const [raw, expected] of fixture.parseStrictNumber) {
    const observed = parseStrictNumber(raw);
    if (expected === null) {
      assert.equal(observed, null, `${JSON.stringify(raw)} should be rejected`);
    } else {
      assert.notEqual(observed, null, `${JSON.stringify(raw)} should parse`);
      assert.ok(Math.abs((observed as number) - expected) < 1e-12, `${JSON.stringify(raw)} → ${observed}, expected ${expected}`);
    }
  }
});

test("splitMagnitudeAndUnit keeps the whole scientific-notation magnitude", () => {
  assert.deepEqual(splitMagnitudeAndUnit("1.5×10^-3 m"), { magnitude: "1.5×10^-3", unit: "m" });
  assert.deepEqual(splitMagnitudeAndUnit("9.8 m/s^2"), { magnitude: "9.8", unit: "m/s^2" });
  assert.deepEqual(splitMagnitudeAndUnit("250"), { magnitude: "250", unit: "" });
  assert.equal(splitMagnitudeAndUnit("2 3 m"), null);
  assert.equal(splitMagnitudeAndUnit("5 (approx)"), null);
});

// --- G1: tolerance rules -------------------------------------------------------------

test("resolveNumericTolerance/numbersMatch match the Python tolerance table", () => {
  for (const row of fixture.numericTolerance) {
    const expected = parseStrictNumber(row.expected);
    const submitted = parseStrictNumber(row.submitted);
    assert.ok(expected !== null && submitted !== null, row.id);
    const { tolerance, kind } = resolveNumericTolerance(
      { tolerance: row.tolerance, answerSpec: { tolerance: row.answerSpecTolerance } },
      row.expected,
    );
    assert.equal(kind, row.kind, `${row.id}: kind`);
    assert.equal(numbersMatch(expected, submitted, tolerance, row.expected, kind, row.submitted), row.match, `${row.id}: match`);
  }
});

test("answerSpec.tolerance = 0 beats question.tolerance = null (explicit exact)", () => {
  assert.deepEqual(resolveNumericTolerance({ tolerance: null, answerSpec: { tolerance: 0 } }, "9.8"), {
    tolerance: 0,
    kind: "explicit",
  });
  assert.deepEqual(resolveNumericTolerance({ tolerance: 0.5, answerSpec: { tolerance: null } }, "9.8"), {
    tolerance: 0.5,
    kind: "explicit",
  });
  assert.deepEqual(resolveNumericTolerance({ tolerance: null }, "250"), { tolerance: 0, kind: "integer_exact" });
  assert.deepEqual(resolveNumericTolerance({ tolerance: null }, "9.8"), { tolerance: 0, kind: "decimal_exact" });
});

// --- G4: credit boundaries ---------------------------------------------------------

test("semanticCreditAwarded matches the Python credit_awarded table", () => {
  for (const row of fixture.semanticCredit) {
    assert.ok(
      Math.abs(semanticCreditAwarded(row.score, row.threshold, row.isCorrect) - row.credit) < 1e-9,
      `score ${row.score}`,
    );
  }
  assert.equal(semanticBand(0.74, 0.82), "near_match");
  assert.equal(semanticBand(0.7399, 0.82), "weak_match");
  assert.equal(semanticBand(0.82, 0.82), "accepted_match");
  // weak_match used to leak 0.15·ratio; it must now be exactly 0 so marks go negative.
  assert.equal(semanticCreditAwarded(0.6, 0.82, false), 0);
  assert.equal(computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0, policy: fixture.policy }), -1);
});

// --- G3: matrix rule -----------------------------------------------------------------

test("gradeMatrixPairs matches the Python matrix table", () => {
  for (const row of fixture.matrix) {
    const grade = gradeMatrixPairs(row.expected, row.submitted, row.partialCreditPolicy);
    const isAnswered = row.submitted.length > 0;
    assert.equal(grade.isCorrect, row.isCorrect, `${row.id}: isCorrect`);
    assert.equal(isAnswered ? grade.creditAwarded : 0, row.credit, `${row.id}: credit`);
    const marks = computeMarksFromCredit({
      answered: isAnswered,
      isCorrect: grade.isCorrect,
      creditAwarded: grade.creditAwarded,
      policy: { ...fixture.policy, partialCreditPolicy: row.partialCreditPolicy },
      noPenalty: !grade.isCorrect && NO_PENALTY_REASONS.has(grade.reason),
    });
    assert.equal(marks, row.marks, `${row.id}: marks`);
    if (isAnswered) assert.equal(grade.reason, row.reason, `${row.id}: reason`);
  }
});

// --- end-to-end: gradeAnswer (local fallback) + computeMarksFromCredit + gradeContest ----

for (const kase of fixture.cases) {
  if (kase.pythonOnly) continue;
  test(`parity: ${kase.id}`, () => {
    const question = storedQuestion(kase.id, kase.question);
    const answer = storedAnswer(kase.id, kase.answer);
    const grade = gradeAnswer(question, answer, "test");
    assert.equal(grade.isCorrect, kase.expect.isCorrect, `isCorrect (${JSON.stringify(grade.info.reasonCodes)})`);
    assert.equal(grade.creditAwarded, kase.expect.creditAwarded, "creditAwarded");
    assert.equal(Boolean(grade.needsReview), kase.expect.needsReview, "needsReview");
    for (const reason of kase.expect.reasonCodes ?? []) {
      assert.ok((grade.info.reasonCodes as string[] | undefined)?.includes(reason), `reason ${reason} in ${JSON.stringify(grade.info.reasonCodes)}`);
    }
    // The local fallback zeroes negatives for numericals by policy; recompute
    // under the fixture policy (the orchestrator does the same with teacher
    // overrides) so marks are compared to the Python engine like-for-like.
    const marks = computeMarksFromCredit({
      answered: answered(kase.answer),
      isCorrect: grade.isCorrect,
      creditAwarded: grade.creditAwarded,
      policy: fixture.policy,
      reviewHold: Boolean(grade.info.reviewHold),
      noPenalty: isNoPenalty(grade),
    });
    assert.equal(marks, kase.expect.marksAwarded, "marksAwarded");

    if (CONTEST_TYPES.has(kase.question.questionType)) {
      const result = gradeContest([contestQuestion(kase.id, kase.question)], { "0": kase.answer }, DEFAULT_CONTEST_SCORING);
      assert.equal(result.perQuestion[0].isCorrect, kase.contestIsCorrect ?? kase.expect.isCorrect, "contest isCorrect");
    }
  });
}

// --- TS-only behaviour (documented deviations from the Python engine) ---------------

test("roundHalfUp rounds the typed digits, not the binary double", () => {
  assert.equal(roundHalfUp(1.005, 2), 1.01);
  assert.equal(roundHalfUp(-1.005, 2), -1.01);
  assert.equal(roundHalfUp(2.675, 2), 2.68);
  assert.equal(roundHalfUp(9.74, 1), 9.7);
  assert.equal(roundHalfUp(1e-7, 6), 0);
  assert.equal(roundHalfUp(1.5e-7, 7), 2e-7);
  assert.equal(roundHalfUp(123456789.123456, 25), 123456789.123456);
});

test("units: the fallback converts table units; anything else is held, and wrong in contests", () => {
  const question = { tolerance: null };
  const converted = gradeNumericText({ expectedText: "1.5×10^-3 m", submittedText: "1.5 mm", question });
  assert.deepEqual([converted.isCorrect, converted.reviewHold], [true, false]);
  const held = gradeNumericText({ expectedText: "9.8 m/s2", submittedText: "980 cm/s^2", question });
  assert.deepEqual([held.isCorrect, held.reviewHold, held.reasonCodes], [false, true, ["unit_conversion_unavailable"]]);
  // A unit outside the table on the answer is held too (pint may know it).
  assert.equal(gradeNumericText({ expectedText: "5 m", submittedText: "5 furlong", question }).reviewHold, true);
  const contest = gradeNumericText({
    expectedText: "9.8 m/s2",
    submittedText: "980 cm/s^2",
    question,
    unitless: "compare_magnitude",
    unitMismatch: "incorrect",
  });
  assert.deepEqual([contest.isCorrect, contest.reviewHold], [false, false]);
  const contestConverted = gradeNumericText({
    expectedText: "5 cm",
    submittedText: "50 mm",
    question,
    unitless: "compare_magnitude",
    unitMismatch: "incorrect",
  });
  assert.equal(contestConverted.isCorrect, true);
  assert.equal(gradeNumericText({ expectedText: "5 μm", submittedText: "5000 nm", question }).isCorrect, true);
  assert.equal(gradeNumericText({ expectedText: "5 µm", submittedText: "0.005 mm", question }).isCorrect, true);
  assert.equal(gradeNumericText({ expectedText: "9.8 m/s^2", submittedText: "9.8 m / s ^ 2", question }).isCorrect, true);
  // M2: a unitless key ignores one trailing unit on the answer.
  const suffixed = gradeNumericText({ expectedText: "250", submittedText: "250 m", question });
  assert.deepEqual([suffixed.isCorrect, suffixed.reasonCodes.slice(0, 2)], [true, ["numeric_compare", "unit_ignored"]]);
});

test("a review hold is never negative, even when marks are recomputed under a teacher mark scheme", () => {
  const question = storedQuestion("hold", { questionType: "numerical", answerText: "9.8 m/s2" });
  const grade = gradeAnswer(question, storedAnswer("hold", { answerText: "980 cm/s^2" }), "test");
  assert.equal(grade.needsReview, true);
  assert.equal(grade.marksAwarded, 0);
  // Remote grader results carry only reason codes; they must be recognised too.
  assert.equal(isReviewHold({ isCorrect: false, info: { reason_codes: ["parse_error"] } }), true);
  assert.equal(isReviewHold({ isCorrect: false, info: { reasonCodes: ["symbolic_mismatch"] } }), false);
  assert.equal(isReviewHold({ isCorrect: true, info: { reviewHold: true } }), false);
  // A remote per-item grader error is our failure, not the student's: held at 0 too.
  const graderError = { isCorrect: false, info: { reason_codes: ["grader_item_error"], needs_review: true } };
  assert.equal(isReviewHold(graderError), true);
  const teacherPolicy = { ...fixture.policy, correctMarks: 3, incorrectMarks: -2 };
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0, policy: teacherPolicy, reviewHold: isReviewHold(grade) }),
    0,
  );
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0, policy: teacherPolicy, reviewHold: isReviewHold(graderError) }),
    0,
  );
});

test("M4: a remote matrix subset is never negative when marks are recomputed under a teacher mark scheme", () => {
  const teacherPolicy = { ...fixture.policy, correctMarks: 3, incorrectMarks: -2 };
  const subset = { isCorrect: false, info: { reason_codes: ["matrix_partial_rows"] } };
  assert.equal(isNoPenalty(subset), true);
  assert.equal(isNoPenalty({ isCorrect: false, info: { reasonCodes: ["matrix_wrong_pair"] } }), false);
  assert.equal(computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0, policy: teacherPolicy, noPenalty: true }), 0);
  assert.equal(computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0.5, policy: teacherPolicy, noPenalty: true }), 1.5);
  assert.equal(computeMarksFromCredit({ answered: true, isCorrect: false, creditAwarded: 0, policy: teacherPolicy, noPenalty: false }), -2);
});

test("fixture is a byte-for-byte copy of the grader-service one (when the monorepo copy is present)", () => {
  let python: string | null = null;
  try {
    python = readFileSync(new URL("../../../grader-service/tests/fixtures/grading-parity.json", import.meta.url), "utf8");
  } catch {
    python = null; // Vercel mirror has no grader-service; nothing to compare against.
  }
  if (python !== null) {
    assert.equal(readFileSync(new URL("../fixtures/grading-parity.json", import.meta.url), "utf8"), python);
  }
});

// ─── M3: CBT numeric grades the same with or without the grader service ──────

type CbtNumericCase = {
  id: string;
  questionType: "numerical" | "numerical_with_units";
  answerText: string;
  tolerance: number | null;
  student: string;
  /** Exactly what CBT sends the service; tests/test_grading_parity.py grades it through engine.py. */
  graderRequest: {
    question: { questionType: string; answerText: string | null; tolerance: number | null; answerSpec: unknown };
    answer: { answerText: string | null };
  };
  expect: { isCorrect: boolean; marksAwarded: number; needsReview: boolean };
};

const cbtNumericCases = (fixture as unknown as { cbtNumeric: CbtNumericCase[] }).cbtNumeric;

for (const c of cbtNumericCases) {
  test(`M3 cbt numeric ${c.id}: local fallback and grader request agree`, () => {
    const row = {
      position: 0,
      questionId: `cbt_${c.id}`,
      questionType: c.questionType,
      stem: "",
      image: null,
      options: [],
      answer: { answerText: c.answerText, tolerance: c.tolerance },
      explanation: null,
      subject: null,
      chapter: null,
      marks: fixture.policy.correctMarks,
      negativeMarks: fixture.policy.incorrectMarks,
    } satisfies TestQuestionRow;

    // Grader down: the local fallback.
    const local = gradeCbtLocal(row.questionType, row.answer, { answerText: c.student }, row.marks, row.negativeMarks);
    assert.deepEqual(
      { isCorrect: local.isCorrect, marksAwarded: local.marksAwarded, needsReview: local.needsReview },
      c.expect,
    );

    // Grader up: the request must be the one the Python half of this fixture grades to `expect`.
    const item = buildCbtGraderItem(row, { answerText: c.student });
    assert.deepEqual(
      {
        question: {
          questionType: item.question.questionType,
          answerText: item.question.answerText,
          tolerance: item.question.tolerance,
          answerSpec: item.question.answerSpec,
        },
        answer: { answerText: item.answer.answerText },
      },
      c.graderRequest,
    );
    assert.equal(item.attemptRef, "0");
  });
}
