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
  /** Correct matrix pairs for matrix_match (array of [row, col] index pairs). */
  matrixData?: number[][] | null;
  /** Per-question marks override; null ⇒ use the scoring config. */
  marks: number | null;
  negativeMarks: number | null;
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

function firstNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
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
      const expected = firstNumber(q.answerText);
      const submitted = firstNumber(a?.answerText);
      const tol = q.tolerance ?? Math.max(Math.abs(expected ?? 0) * 0.01, 0.001);
      return {
        correct: expected !== null && submitted !== null && Math.abs(submitted - expected) <= tol,
        answered,
      };
    }
    case "matrix_match": {
      // Order-independent set comparison of [row, col] pairs.
      const norm = (pairs: number[][] | null | undefined) =>
        JSON.stringify([...(pairs ?? [])].map((p) => [Number(p[0]), Number(p[1])]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
      const expected = norm(q.matrixData);
      const submitted = norm(a?.matrixPairs);
      return { correct: (q.matrixData?.length ?? 0) > 0 && expected === submitted, answered };
    }
    default:
      // Unknown/symbolic/subjective types: treat as ungraded (not correct); still
      // counted. (Symbolic needs the async grader-service, kept out of the
      // game-day-safe local finalize path; not offered in the contest builder.)
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
