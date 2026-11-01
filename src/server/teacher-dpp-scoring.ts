/**
 * Marks-based scoring for teacher-shared DPPs.
 * Plan: V1/allmd/TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md (Phase A)
 *
 * An auto-generated DPP has no author, so it scores on a flat default policy.
 * A teacher-shared DPP does have one: the teacher already decided what each
 * question is worth when they built the test. This module turns that snapshot
 * into per-question scoring policies the existing grading pipeline understands,
 * so a correct answer in the DPP is worth exactly what it was worth in the test.
 */

import { canonicalNegativeMarks } from "@/lib/assessments/source-stack";
import { DEFAULT_TEST_SCORING_POLICY } from "@/server/assessment-orchestrator";
import type { GraderScoringPolicy } from "@/server/grader-client";
import type { TeacherDppQuestionMarks } from "@/server/workspaces/types";

/**
 * One question's marks → a grading policy.
 *
 * The teacher's number always wins (decision D2): a question they marked with 0
 * negative gets NO negative marking here, even though the platform default for
 * a DPP question would apply -1. That includes numerical questions, whose
 * usual no-negative special case is simply subsumed by the teacher's own value.
 *
 * The snapshot's `n` is canonicalised on the way in, NOT trusted as stored. Every
 * share taken before 2026-08-10 snapshotted whatever sign the authoring UI
 * happened to use, and the wizard used a positive magnitude — which read here as
 * "no negative marking, and a wrong answer is worth +1", so a student who got
 * every question wrong scored +7/28 instead of -7/28. Normalising at the point of
 * use is what repairs those live shares with no migration and no re-share.
 */
export function policyFromQuestionMarks(marks: TeacherDppQuestionMarks): GraderScoringPolicy {
  const correctMarks = Number.isFinite(marks.m) ? marks.m : DEFAULT_TEST_SCORING_POLICY.correctMarks;
  const incorrectMarks = Number.isFinite(marks.n) ? canonicalNegativeMarks(marks.n) : 0;
  return {
    correctMarks,
    incorrectMarks,
    unattemptedMarks: 0,
    partialCreditPolicy: DEFAULT_TEST_SCORING_POLICY.partialCreditPolicy,
    negativeMarkingMode: incorrectMarks < 0 ? "answered_only" : "none",
  };
}

/**
 * Builds the per-question policy map for a shared DPP from the snapshot taken
 * at share time. The two arrays are parallel by construction
 * (`resolveShareQuestions`); anything that falls outside that pairing — a
 * shorter marks array, a share created before scoring existed — is left out of
 * the map so those questions fall back to the platform default rather than
 * silently scoring 0.
 *
 * Returns null when there is nothing to override, which is the signal to the
 * caller that this DPP is not marks-scored at all.
 */
export function buildTeacherDppScoringOverrides(
  questionIds: readonly string[],
  questionMarks: readonly TeacherDppQuestionMarks[] | null,
): Map<string, GraderScoringPolicy> | null {
  if (!questionMarks || questionMarks.length === 0) return null;
  const overrides = new Map<string, GraderScoringPolicy>();
  for (let i = 0; i < questionIds.length; i += 1) {
    const marks = questionMarks[i];
    if (!marks) continue;
    overrides.set(questionIds[i], policyFromQuestionMarks(marks));
  }
  return overrides.size > 0 ? overrides : null;
}

/**
 * Percentage guard: a paper whose questions are all worth 0 marks has no
 * meaningful percentage, and dividing by it would yield NaN/Infinity that then
 * poisons every AVG downstream. Null is the honest answer (edge case E8).
 */
export function safePercentage(score: number, totalMarks: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(totalMarks) || totalMarks <= 0) return null;
  return Math.round((score / totalMarks) * 10000) / 100;
}

/**
 * Platform points (AIR, Hall of Fame, championship) are NOT the teacher's marks.
 *
 * A teacher-shared DPP scores at whatever marks the teacher typed, and those
 * used to be paid out 1:1 as platform points — so a self-registered teacher
 * could set `marks: 1e9` on one question, share it to a batch holding their own
 * alt account, and top every leaderboard (every new share is a new award key).
 *
 * The platform pays a teacher DPP on the same scale as the DPP it would have
 * generated itself: an auto DPP is 10 questions at the flat +4 default, so it
 * can pay at most 40 points. A teacher DPP pays that same ceiling scaled by the
 * student's percentage on the teacher's paper. The teacher's own weighting
 * still decides the DPP's score, percentage and the teacher's practice board;
 * it just cannot mint platform points beyond what a full-marks auto DPP earns.
 */
export const TEACHER_DPP_POINTS_CAP = 10 * DEFAULT_TEST_SCORING_POLICY.correctMarks;

export function teacherDppPlatformPoints(score: number, totalMarks: number): number {
  return scaledPlatformPoints(score, totalMarks, TEACHER_DPP_POINTS_CAP);
}

/**
 * Same rule for a teacher-ASSIGNED test (batch assignment or teacher room).
 *
 * Its score is graded on the teacher's own `questionMarking`, so paying
 * `analytics.score` 1:1 — as a platform-authored test does — let a 50-question
 * paper at 100 marks each mint 5 000 points per new test (25× the +4 default),
 * every new test being a new award key. A platform test of the same length can
 * pay at most `questionCount × correctMarks`; a teacher test pays that same
 * ceiling scaled by the student's percentage on the teacher's paper. Platform-
 * authored tests are unchanged.
 */
export function teacherTestPlatformPoints(score: number, totalMarks: number, questionCount: number): number {
  const count = Number.isFinite(questionCount) ? Math.max(0, Math.floor(questionCount)) : 0;
  return scaledPlatformPoints(score, totalMarks, count * DEFAULT_TEST_SCORING_POLICY.correctMarks);
}

function scaledPlatformPoints(score: number, totalMarks: number, cap: number): number {
  const percentage = safePercentage(score, totalMarks);
  if (percentage === null || percentage <= 0 || !(cap > 0)) return 0;
  return Math.round((Math.min(100, percentage) / 100) * cap);
}
