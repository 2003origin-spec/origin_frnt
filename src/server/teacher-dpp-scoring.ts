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
 */
export function policyFromQuestionMarks(marks: TeacherDppQuestionMarks): GraderScoringPolicy {
  const correctMarks = Number.isFinite(marks.m) ? marks.m : DEFAULT_TEST_SCORING_POLICY.correctMarks;
  const incorrectMarks = Number.isFinite(marks.n) ? marks.n : 0;
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
