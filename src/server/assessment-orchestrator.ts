import type { GraderScoringPolicy } from "@/server/grader-client";
import type { StoredQuestion } from "@/server/store";

export type AssessmentSourceType = "test" | "custom_test" | "room_test" | "dpp" | "ogcode" | "practice";

export type AssessmentResolutionMetadata = {
  declaredTotalQuestions: number | null;
  resolvedTotalQuestions: number;
  missingQuestionIds: string[];
  countMismatch: boolean;
  degraded: boolean;
  degradedReason: string | null;
};

export const DEFAULT_TEST_SCORING_POLICY: GraderScoringPolicy = {
  correctMarks: 4,
  incorrectMarks: -1,
  unattemptedMarks: 0,
  partialCreditPolicy: "fractional",
  negativeMarkingMode: "answered_only",
};

export function scoringPolicyForQuestion(
  question: Pick<StoredQuestion, "questionType">,
  sourceType: AssessmentSourceType,
): GraderScoringPolicy {
  if (question.questionType === "numerical" || sourceType === "ogcode" || sourceType === "practice") {
    return {
      ...DEFAULT_TEST_SCORING_POLICY,
      incorrectMarks: 0,
      negativeMarkingMode: "none",
    };
  }

  return DEFAULT_TEST_SCORING_POLICY;
}

/**
 * Turn a full-length blueprint's marking scheme into a grader policy.
 *
 * Unlike `scoringPolicyForQuestion`, this does NOT special-case question type:
 * a blueprint section states what its questions are worth, and that is the
 * authority (a JEE Advanced numerical section is +4/0 because the exam says so,
 * not because the platform zeroes negatives for numericals). The resulting
 * policies are persisted per question and replayed at grade time through
 * `buildAnalyticsAttempts`'s `policyOverrides`, which already wins over both the
 * platform default and the remote grader's own numbers.
 *
 * See V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §4 and D4.
 */
export function examMarkingToScoringPolicy(marking: {
  correct: number;
  incorrect: number;
  unattempted: number;
  partialPerCorrectOption?: number;
}): GraderScoringPolicy {
  return {
    correctMarks: marking.correct,
    incorrectMarks: marking.incorrect,
    unattemptedMarks: marking.unattempted,
    partialCreditPolicy: marking.partialPerCorrectOption == null ? "none" : "fractional",
    // `incorrect: 0` means the exam has no negative marking for this section, so
    // a wrong answer must floor at zero rather than fall through to a negative.
    negativeMarkingMode: marking.incorrect === 0 ? "none" : "answered_only",
    ...(marking.partialPerCorrectOption == null
      ? {}
      : {
          partialCreditMode: "per_correct_option" as const,
          partialUnitMarks: marking.partialPerCorrectOption,
        }),
  };
}

export function computeMarksFromCredit(input: {
  answered: boolean;
  isCorrect: boolean;
  creditAwarded?: number | null;
  policy: GraderScoringPolicy;
  /**
   * Number of units full credit is made of — for MSQ, the count of correct
   * options. Only consulted under `partialCreditMode: "per_correct_option"`,
   * which needs it to turn the fractional credit the grader reports back into
   * "how many correct options did they actually pick". Absent ⇒ the policy
   * degrades to ordinary fractional partial credit rather than mis-scoring.
   */
  partialUnits?: number | null;
}) {
  const credit = Math.max(0, Math.min(1, Number(input.creditAwarded ?? (input.isCorrect ? 1 : 0))));
  if (!input.answered) {
    return input.policy.unattemptedMarks;
  }
  if (input.isCorrect) {
    return input.policy.correctMarks;
  }
  if (credit > 0 && input.policy.partialCreditPolicy !== "none") {
    // JEE Advanced multiple-correct: +N per correct option chosen, not a
    // fraction of the full marks. `credit` is chosen/expected, so multiplying it
    // back out by the expected count recovers the chosen count exactly.
    const units = Number(input.partialUnits ?? 0);
    if (input.policy.partialCreditMode === "per_correct_option" && units > 0) {
      const chosen = Math.round(credit * units);
      return Number((chosen * (input.policy.partialUnitMarks ?? 1)).toFixed(3));
    }
    return Number((input.policy.correctMarks * credit).toFixed(3));
  }
  if (input.policy.negativeMarkingMode === "none" || input.policy.negativeMarkingMode === "no_negative") {
    return Math.max(0, input.policy.incorrectMarks);
  }
  return input.policy.incorrectMarks;
}

export function validateResolvedAssessmentQuestions(input: {
  declaredTotalQuestions?: number | null;
  questionIds: string[];
  resolvedQuestionIds: string[];
}): AssessmentResolutionMetadata {
  const resolvedSet = new Set(input.resolvedQuestionIds);
  const missingQuestionIds = input.questionIds.filter((questionId) => !resolvedSet.has(questionId));
  const declaredTotalQuestions = input.declaredTotalQuestions ?? null;
  const countMismatch =
    declaredTotalQuestions !== null &&
    declaredTotalQuestions !== input.resolvedQuestionIds.length;
  const degraded = missingQuestionIds.length > 0 || countMismatch;
  const reasonParts = [
    missingQuestionIds.length > 0 ? `${missingQuestionIds.length} referenced questions could not be resolved` : null,
    countMismatch ? `declared total ${declaredTotalQuestions} differs from resolved total ${input.resolvedQuestionIds.length}` : null,
  ].filter(Boolean);

  return {
    declaredTotalQuestions,
    resolvedTotalQuestions: input.resolvedQuestionIds.length,
    missingQuestionIds,
    countMismatch,
    degraded,
    degradedReason: reasonParts.length ? reasonParts.join("; ") : null,
  };
}
