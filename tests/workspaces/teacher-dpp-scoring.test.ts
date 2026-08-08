import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTeacherDppScoringOverrides,
  policyFromQuestionMarks,
  safePercentage,
} from "../../src/server/teacher-dpp-scoring";
import { resolveShareQuestions } from "../../src/server/workspaces/teacher-dpp-service";
import {
  PRACTICE_INDEX_DPP_WEIGHT,
  computePracticeIndex,
  rankPractitioners,
  summarisePractice,
} from "../../src/server/workspaces/practice-leaderboard";
import type { BatchPracticeRowLite } from "../../src/server/workspaces/batch-cohort-store";
import type { TestQuestion } from "../../src/server/workspaces/types";

function question(overrides: Partial<TestQuestion>): TestQuestion {
  return {
    testId: "test_1",
    position: 1,
    sourceBank: "ogcode",
    ogcodeQuestionId: null,
    contentQuestionId: null,
    contentQuestionVersionId: null,
    marks: 4,
    negativeMarks: -1,
    metadata: {},
    ...overrides,
  };
}

// ─── marks snapshot ────────────────────────────────────────────────────────────

test("share snapshot carries each question's marks parallel to its id", () => {
  const { questionIds, questionMarks } = resolveShareQuestions([
    question({ position: 2, ogcodeQuestionId: "og_2", marks: 2, negativeMarks: 0 }),
    question({ position: 1, ogcodeQuestionId: "og_1", marks: 4, negativeMarks: -1 }),
  ]);

  assert.deepEqual(questionIds, ["og_1", "og_2"]);
  assert.deepEqual(questionMarks, [
    { m: 4, n: -1 },
    { m: 2, n: 0 },
  ]);
});

test("dropping a duplicate question drops its marks too, keeping the arrays aligned", () => {
  const { questionIds, questionMarks } = resolveShareQuestions([
    question({ position: 1, ogcodeQuestionId: "og_1", marks: 4 }),
    question({ position: 2, ogcodeQuestionId: "og_1", marks: 99 }),
    question({ position: 3, ogcodeQuestionId: "og_2", marks: 3 }),
  ]);

  assert.equal(questionIds.length, questionMarks.length);
  assert.deepEqual(questionIds, ["og_1", "og_2"]);
  assert.deepEqual(questionMarks.map((m) => m.m), [4, 3]);
});

// ─── scoring policy ────────────────────────────────────────────────────────────

test("a question's policy uses the teacher's marks, with negative marking on", () => {
  const policy = policyFromQuestionMarks({ m: 4, n: -1 });
  assert.equal(policy.correctMarks, 4);
  assert.equal(policy.incorrectMarks, -1);
  assert.equal(policy.negativeMarkingMode, "answered_only");
});

test("zero negative marks means NO negative marking — the teacher's number wins", () => {
  // The platform default would apply -1 to a non-numerical DPP question. A
  // teacher who set 0 must not have that reinstated behind their back (D2).
  const policy = policyFromQuestionMarks({ m: 5, n: 0 });
  assert.equal(policy.incorrectMarks, 0);
  assert.equal(policy.negativeMarkingMode, "none");
});

test("overrides map ids to policies, and a share with no snapshot yields null", () => {
  const overrides = buildTeacherDppScoringOverrides(
    ["q1", "q2"],
    [
      { m: 4, n: -1 },
      { m: 2, n: 0 },
    ],
  );
  assert.equal(overrides?.get("q1")?.correctMarks, 4);
  assert.equal(overrides?.get("q2")?.correctMarks, 2);

  // Pre-scoring shares fall back to the default policy rather than scoring 0.
  assert.equal(buildTeacherDppScoringOverrides(["q1"], null), null);
  assert.equal(buildTeacherDppScoringOverrides(["q1"], []), null);
});

test("a short marks array leaves the extra questions on the default policy", () => {
  const overrides = buildTeacherDppScoringOverrides(["q1", "q2", "q3"], [{ m: 4, n: -1 }]);
  assert.equal(overrides?.size, 1);
  assert.equal(overrides?.has("q2"), false);
});

test("percentage guards a zero-mark paper instead of returning NaN", () => {
  assert.equal(safePercentage(12, 20), 60);
  assert.equal(safePercentage(0, 0), null);
  assert.equal(safePercentage(5, -1), null);
  assert.equal(safePercentage(Number.NaN, 10), null);
});

// ─── practitioner ranking ──────────────────────────────────────────────────────

function practiceRow(overrides: Partial<BatchPracticeRowLite>): BatchPracticeRowLite {
  return {
    studentId: "s1",
    displayName: "Student One",
    dppScore: 0,
    dppTotalMarks: 0,
    dppsAttempted: 0,
    questionsAttempted: 0,
    ogcodeScore: 0,
    ogcodeQuestions: 0,
    lastPractisedAt: null,
    ...overrides,
  };
}

test("practice index normalises each source, so OG Code cannot swamp the DPPs", () => {
  // The whole point of normalising: in production OG Code totals reach ~4700
  // while a DPP is worth ~200. A raw sum would make the board pure OG Code.
  const rows = [
    practiceRow({ studentId: "dpp_star", displayName: "A", dppScore: 200, ogcodeScore: 0 }),
    practiceRow({ studentId: "og_grinder", displayName: "B", dppScore: 0, ogcodeScore: 4700 }),
  ];
  const ranked = rankPractitioners(rows, "combined");

  // 0.6 * 1 = 60 for the DPP leader, 0.4 * 1 = 40 for the OG Code leader.
  assert.equal(ranked[0].studentId, "dpp_star");
  assert.equal(ranked[0].practiceIndex, Math.round(PRACTICE_INDEX_DPP_WEIGHT * 100));
  assert.equal(ranked[1].studentId, "og_grinder");
  assert.equal(ranked[1].practiceIndex, Math.round((1 - PRACTICE_INDEX_DPP_WEIGHT) * 100));
});

test("index is 0-100 and a batch with no practice at all does not divide by zero", () => {
  assert.equal(computePracticeIndex({ dppScore: 0, ogcodeScore: 0 }, 0, 0), 0);
  assert.equal(computePracticeIndex({ dppScore: 50, ogcodeScore: 100 }, 50, 100), 100);
});

test("ranking basis switches the board without changing the raw columns", () => {
  const rows = [
    practiceRow({ studentId: "a", displayName: "A", dppScore: 100, ogcodeScore: 10 }),
    practiceRow({ studentId: "b", displayName: "B", dppScore: 10, ogcodeScore: 900 }),
  ];

  assert.equal(rankPractitioners(rows, "dpp")[0].studentId, "a");
  assert.equal(rankPractitioners(rows, "ogcode")[0].studentId, "b");
  // Raw components survive whichever basis is used.
  const byOgcode = rankPractitioners(rows, "ogcode");
  assert.equal(byOgcode[0].dppScore, 10);
  assert.equal(byOgcode[0].ogcodeScore, 900);
});

test("ties break on DPP accuracy, then volume", () => {
  const rows = [
    practiceRow({
      studentId: "sloppy",
      displayName: "Sloppy",
      dppScore: 50,
      dppTotalMarks: 200,
      dppsAttempted: 1,
      questionsAttempted: 4,
    }),
    practiceRow({
      studentId: "sharp",
      displayName: "Sharp",
      dppScore: 50,
      dppTotalMarks: 60,
      dppsAttempted: 1,
      questionsAttempted: 1,
    }),
  ];
  const ranked = rankPractitioners(rows, "dpp");
  assert.equal(ranked[0].studentId, "sharp");
  assert.equal(ranked[0].dppAccuracy, 83.3);
});

test("students who have not practised are ranked last, not dropped", () => {
  // "Who has not started" is exactly the signal a teacher opens this for.
  const ranked = rankPractitioners([
    practiceRow({ studentId: "idle", displayName: "Idle" }),
    practiceRow({ studentId: "busy", displayName: "Busy", dppScore: 40, dppsAttempted: 1, questionsAttempted: 2 }),
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[1].studentId, "idle");
  assert.equal(ranked[1].practiceIndex, 0);
});

test("summary counts a student active on EITHER source", () => {
  const summary = summarisePractice(
    rankPractitioners([
      practiceRow({ studentId: "a", displayName: "A", dppScore: 8, dppTotalMarks: 10, dppsAttempted: 1, questionsAttempted: 1 }),
      practiceRow({ studentId: "b", displayName: "B", ogcodeQuestions: 3, ogcodeScore: 30 }),
      practiceRow({ studentId: "c", displayName: "C" }),
    ]),
  );
  assert.equal(summary.totalStudents, 3);
  assert.equal(summary.activePractitioners, 2);
  assert.equal(summary.questionsAttempted, 1);
  assert.equal(summary.meanDppAccuracy, 80);
});
