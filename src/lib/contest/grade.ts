/**
 * Contest grading — pure, from the FROZEN paper snapshot + the answer draft +
 * the Contest Points scoring config (plan Phase 4, §3b). Objective types only
 * (MCQ / MSQ / numerical); subjective is out of V1 scope for the contest.
 *
 * Grading is against the immutable contest.contest_questions snapshot (never the
 * live OGCode bank), so a later edit can't change what was scored. The count
 * invariant correct + incorrect + unattempted == paper size holds by
 * construction (every position is classified exactly once).
 */

import type { ContestScoringConfig } from "./contest-config";
import { gradeMatrixPairs } from "@/lib/assessments/matrix-grade";
import { gradeNumericText } from "@/lib/assessments/numeric-tolerance";

/** The frozen per-question data needed to grade (from contest_questions.snapshot). */
export interface GradableQuestion {
  position: number;
  questionId: string;
  subject: string | null;
  questionType: string;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  tolerance: number | null;
  /** Frozen answer spec; its `tolerance` (teacher-set, 0 ⇒ exact) wins over `tolerance` (G1). */
  answerSpec?: { tolerance?: number | null } | null;
  /** Correct matrix pairs for matrix_match (array of [row, col] index pairs). */
  matrixData?: number[][] | null;
  /** Per-question marks override; null ⇒ use the scoring config. */
  marks: number | null;
  negativeMarks: number | null;
}

/**
 * Correct [row, col] pairs from a frozen snapshot's `matrixData`.
 *
 * The snapshot freezes the OGCode catalog's `matrix_data` as-is
 * (contest-question-selection.ts `freezeSnapshot`), i.e. the
 * `StoredMatrixData` OBJECT `{ column_a, column_b, correct_pairs }` — never a
 * bare pairs array, so reading it with `Array.isArray` made every contest
 * matrix question unscorable. Also tolerates a JSON-string column, camelCase
 * `correctPairs` and a legacy bare `number[][]`.
 */
export function snapshotMatrixPairs(raw: unknown): number[][] | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    value = record.correct_pairs ?? record.correctPairs;
  }
  if (!Array.isArray(value)) return null;
  const pairs = value
    .filter((pair): pair is unknown[] => Array.isArray(pair) && pair.length >= 2)
    .map((pair) => [Number(pair[0]), Number(pair[1])])
    .filter((pair) => pair.every((n) => Number.isInteger(n) && n >= 0));
  return pairs.length > 0 ? pairs : null;
}

/** A student's submitted answer for one position (from the draft's `answers`). */
export interface SubmittedAnswer {
  selectedOption?: number | null;
  selectedOptions?: number[] | null;
  answerText?: string | null;
  matrixPairs?: number[][] | null;
}

export interface QuestionResult {
  position: number;
  questionId: string;
  isCorrect: boolean;
  answered: boolean;
  marksAwarded: number;
}

export interface GradeResult {
  score: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  perQuestion: QuestionResult[];
  sectionScores: Record<string, { score: number; correct: number; total: number }>;
}

function isAnswered(a: SubmittedAnswer | undefined): boolean {
  if (!a) return false;
  if (typeof a.selectedOption === "number") return true;
  if (Array.isArray(a.selectedOptions) && a.selectedOptions.length > 0) return true;
  if (typeof a.answerText === "string" && a.answerText.trim() !== "") return true;
  if (Array.isArray(a.matrixPairs) && a.matrixPairs.length > 0) return true;
  return false;
}

function gradeOne(q: GradableQuestion, a: SubmittedAnswer | undefined): { correct: boolean; answered: boolean } {
  const answered = isAnswered(a);
  switch (q.questionType) {
    case "mcq":
      return { correct: typeof q.correctOption === "number" && a?.selectedOption === q.correctOption, answered };
    case "msq": {
      const expected = [...(q.correctOptions ?? [])].sort((x, y) => x - y);
      const submitted = [...(a?.selectedOptions ?? [])].sort((x, y) => x - y);
      return { correct: expected.length > 0 && JSON.stringify(expected) === JSON.stringify(submitted), answered };
    }
    case "numerical":
    case "numerical_with_units": {
      // G1 + G2 (same rules as grader-service compare_numeric): one strictly
      // parsed number per side, exact unless the snapshot carries a tolerance.
      // A unit in the snapshot answer ("9.8 m/s^2") is matched by text — the
      // player says "include units if asked", so a bare number is compared by
      // magnitude; a common SI unit is converted ("5 cm" = "50 mm"); any other
      // different unit is wrong (contests have no review hold).
      return {
        correct: gradeNumericText({
          expectedText: q.answerText,
          submittedText: a?.answerText,
          question: { tolerance: q.tolerance, answerSpec: q.answerSpec },
          unitless: "compare_magnitude",
          unitMismatch: "incorrect",
        }).isCorrect,
        answered,
      };
    }
    case "matrix_match": {
      // Exact set match only (contests award no partial credit); the shared
      // helper also rejects supersets (G3).
      return { correct: gradeMatrixPairs(q.matrixData, a?.matrixPairs, "none").isCorrect, answered };
    }
    default:
      // Unknown/symbolic/subjective types: treat as ungraded (not correct); still
      // counted. (Symbolic needs the async grader-service, kept out of the
      // game-day-safe local finalize path; not offered in the contest builder.)
      // G5: the answer text is never parsed or evaluated here, so no symbolic
      // guard is needed (see lib/assessments/symbolic-guard.ts for the fallback's).
      return { correct: false, answered };
  }
}

/**
 * Grade a whole contest paper. `answers` is keyed by position (string keys, as
 * stored in the draft JSONB). Marks come from the per-question override or the
 * scoring config's correct/incorrect marks.
 */
export function gradeContest(
  questions: GradableQuestion[],
  answers: Record<string, SubmittedAnswer>,
  config: ContestScoringConfig,
): GradeResult {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const perQuestion: QuestionResult[] = [];
  const sectionScores: Record<string, { score: number; correct: number; total: number }> = {};

  for (const q of questions) {
    const a = answers[String(q.position)];
    const { correct: isCorrect, answered } = gradeOne(q, a);
    const correctMarks = q.marks ?? config.correctMarks;
    const incorrectMarks = q.negativeMarks ?? config.incorrectMarks;

    let marksAwarded: number;
    if (isCorrect) marksAwarded = correctMarks;
    else if (answered) marksAwarded = incorrectMarks;
    else marksAwarded = config.unattemptedMarks;

    score += marksAwarded;
    if (isCorrect) correct += 1;
    else if (answered) incorrect += 1;
    else unattempted += 1;

    const section = q.subject ?? "General";
    const s = sectionScores[section] ?? { score: 0, correct: 0, total: 0 };
    s.score += marksAwarded;
    s.total += 1;
    if (isCorrect) s.correct += 1;
    sectionScores[section] = s;

    perQuestion.push({ position: q.position, questionId: q.questionId, isCorrect, answered, marksAwarded });
  }

  return {
    score: Number(score.toFixed(3)),
    correct,
    incorrect,
    unattempted,
    perQuestion,
    sectionScores,
  };
}
