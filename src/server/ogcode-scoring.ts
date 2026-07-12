/**
 * OGCode Scoring V2 — the CS_core scoring engine
 * (V1/OGCODE_SCORING_ALGORITHM.md, Phase 2).
 *
 * Pure function, no I/O: correctness comes from the untouched grading
 * pipeline (grader-service / local gradeAnswer()), attempt/reveal state from
 * ogcode-progress.ts. This module only turns those inputs into points.
 *
 * Score model per question type:
 *  - MCQ / Numerical / Range: clamped time ratio × base score, divided by the
 *    attempt count (retry loop, caps in OGCODE_ATTEMPT_CAPS).
 *  - MSQ / Matrix Match: single-attempt, JEE Advanced marking (full / partial
 *    / 0 / NEGATIVE for any wrong pick) — incompatible with free retries.
 *  - Subjective: single-attempt, flat bs if correct (no time term — the
 *    (bt/tt) ratio doesn't fit an essay answer).
 * Hint reveal halves the base score, answer reveal zeroes it (set-once flags
 * from ogcode-progress). A question attempted before this session scores 0.
 */

import type { DifficultyLevel, QuestionType } from "@/server/store";

/** Per-difficulty base score (bs) and base time (bt, seconds) — §3 of the plan. */
export const OGCODE_BASE_SCORING: Record<DifficultyLevel, { bs: number; bt: number }> = {
  easy: { bs: 5, bt: 30 },
  medium: { bs: 15, bt: 60 },
  hard: { bs: 30, bt: 100 },
  insane: { bs: 50, bt: 120 },
};

/**
 * Graded-submission caps for the retry-loop types. A type absent from this map
 * is single-attempt (MSQ, Matrix Match, Subjective). The question terminates
 * when the answer is correct OR total_attempts reaches the cap, checked AFTER
 * grading the current submission — students get exactly this many graded tries.
 */
export const OGCODE_ATTEMPT_CAPS: Partial<Record<QuestionType, number>> = {
  mcq: 3,
  numerical: 4,
  range: 4,
};

export function isSingleAttemptType(questionType: QuestionType): boolean {
  return OGCODE_ATTEMPT_CAPS[questionType] === undefined;
}

export type OgcodeScoreInput = {
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  /** Verdict from the correctness engine (grader-service / gradeAnswer). */
  isCorrect: boolean;
  /** Cumulative tt for the whole session — never reset between retries. */
  timeSpentSeconds: number;
  /** progress.total_attempts AFTER this submission's atomic increment (>= 1). */
  totalAttempts: number;
  /** Reveal flags at grading time (set-once, from ogcode-progress). */
  hintRevealed: boolean;
  answerRevealed: boolean;
  /** progress.attempted as read at session open — true ⇒ re-attempt, no score. */
  attemptedBeforeSession: boolean;
  /** MSQ selection breakdown (required for questionType === "msq"). */
  msq?: { totalCorrectOptions: number; correctChosen: number; wrongChosen: number };
  /** Matrix Match row breakdown (required for questionType === "matrix_match"). */
  matrix?: { totalRows: number; correctRows: number; wrongRows: number };
};

export type OgcodeScoreResult = {
  /** Points awarded. May be NEGATIVE for MSQ/Matrix (JEE wrong-pick rule). */
  score: number;
  /** bs for the difficulty, pre-decay — the ceiling a clean solve could earn. */
  maxScore: number;
  /** Why the score came out this way, e.g. ["hint_decay", "attempt_divisor:3"]. */
  reasons: string[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeOgcodeScore(input: OgcodeScoreInput): OgcodeScoreResult {
  const { bs, bt } = OGCODE_BASE_SCORING[input.difficulty] ?? OGCODE_BASE_SCORING.medium;
  const reasons: string[] = [];

  // Rule 1 — re-attempts of an already-attempted question never re-score.
  if (input.attemptedBeforeSession) {
    return { score: 0, maxScore: bs, reasons: ["already_attempted"] };
  }

  // Rule 2 — reveal decay: answer ⇒ 0, hint ⇒ bs/2 (applies exactly once; the
  // flags are set-once in ogcode-progress).
  let effectiveBase = bs;
  if (input.answerRevealed) {
    effectiveBase = 0;
    reasons.push("answer_reveal_zero");
  } else if (input.hintRevealed) {
    effectiveBase = bs / 2;
    reasons.push("hint_decay");
  }

  // Rule 3 — Subjective: flat bs' if correct, no time term, no divisor.
  if (input.questionType === "subjective") {
    reasons.push("subjective_flat");
    return { score: round2(input.isCorrect ? effectiveBase : 0), maxScore: bs, reasons };
  }

  // Rule 4 — MSQ: JEE Advanced table scaled by bs'/4.
  //   all correct chosen, no wrong → +4 ⇒ bs'
  //   partial correct subset, no wrong → +1 per correct chosen ⇒ 0.25·bs' each
  //   blank → 0 ; any wrong pick → −2 ⇒ −0.5·bs'
  if (input.questionType === "msq") {
    const sel = input.msq ?? { totalCorrectOptions: 0, correctChosen: 0, wrongChosen: 0 };
    if (sel.wrongChosen > 0) {
      reasons.push("jee_wrong_pick_penalty");
      return { score: round2(-0.5 * effectiveBase), maxScore: bs, reasons };
    }
    if (sel.correctChosen === 0) {
      reasons.push("jee_blank");
      return { score: 0, maxScore: bs, reasons };
    }
    if (sel.correctChosen >= sel.totalCorrectOptions) {
      reasons.push("jee_full");
      return { score: round2(effectiveBase), maxScore: bs, reasons };
    }
    reasons.push(`jee_partial:${sel.correctChosen}`);
    return { score: round2(Math.min(sel.correctChosen, 4) * 0.25 * effectiveBase), maxScore: bs, reasons };
  }

  // Rule 5 — Matrix Match: JEE-style per row.
  //   all rows correct → bs' ; partial (no wrong rows) → (correct/R)·bs'
  //   blank → 0 ; any wrong row → −0.5·bs'
  if (input.questionType === "matrix_match") {
    const rows = input.matrix ?? { totalRows: 0, correctRows: 0, wrongRows: 0 };
    if (rows.wrongRows > 0) {
      reasons.push("jee_wrong_row_penalty");
      return { score: round2(-0.5 * effectiveBase), maxScore: bs, reasons };
    }
    if (rows.correctRows === 0 || rows.totalRows <= 0) {
      reasons.push("jee_blank");
      return { score: 0, maxScore: bs, reasons };
    }
    if (rows.correctRows >= rows.totalRows) {
      reasons.push("jee_full");
      return { score: round2(effectiveBase), maxScore: bs, reasons };
    }
    reasons.push(`jee_partial_rows:${rows.correctRows}/${rows.totalRows}`);
    return { score: round2((rows.correctRows / rows.totalRows) * effectiveBase), maxScore: bs, reasons };
  }

  // Rule 6 — MCQ / Numerical / Range: CS_core = min(1, bt/max(tt,1)) × bs',
  // divided by the attempt count. Wrong terminal outcome (cap exhausted) ⇒ 0.
  if (!input.isCorrect) {
    reasons.push("incorrect");
    return { score: 0, maxScore: bs, reasons };
  }
  const timeRatio = Math.min(1, bt / Math.max(input.timeSpentSeconds, 1));
  const attempts = Math.max(1, Math.trunc(input.totalAttempts));
  if (attempts > 1) {
    reasons.push(`attempt_divisor:${attempts}`);
  }
  reasons.push(`time_ratio:${round2(timeRatio)}`);
  return { score: round2((timeRatio * effectiveBase) / attempts), maxScore: bs, reasons };
}
