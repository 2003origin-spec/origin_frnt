/**
 * Contest scoring config + schedule validation — pure, client-safe helpers used
 * by the admin builder (server) and the config UI (client). No DB, no imports of
 * server-only code.
 *
 * Contest Points is a grader ScoringPolicy variant (plan §3b): configurable
 * correct / incorrect / unattempted marks, plus optional difficulty multiplier
 * and time bonus. The anti-guessing guardrail (plan §5, contest-design §5) —
 * "correct answers must remain substantially more valuable than incorrect
 * attempts" — is enforced here so a self-service admin cannot ship a paper where
 * random guessing dominates.
 */

export interface ContestScoringConfig {
  correctMarks: number;
  /** Marks for an attempted-but-wrong answer. Positive rewards attempting
   *  (PRD default +2); negative enables exam-style negative marking. */
  incorrectMarks: number;
  unattemptedMarks: number;
  /** Optional: scale marks by question difficulty. */
  difficultyMultiplier: boolean;
  /** Optional: award a time bonus for faster correct answers. */
  timeBonus: boolean;
  partialCreditPolicy: "fractional" | "none";
  negativeMarkingMode: "answered_only" | "all";
}

/** PRD initial proposal: +10 correct, +2 incorrect-attempted, 0 unattempted. */
export const DEFAULT_CONTEST_SCORING: ContestScoringConfig = {
  correctMarks: 10,
  incorrectMarks: 2,
  unattemptedMarks: 0,
  difficultyMultiplier: false,
  timeBonus: false,
  partialCreditPolicy: "fractional",
  negativeMarkingMode: "answered_only",
};

/**
 * Minimum ratio of correct-marks to a POSITIVE incorrect-marks. With the PRD
 * default (+10 / +2) the ratio is 5×; we require at least this so a guesser's
 * expected gain can never approach a solver's. Only applies when incorrect
 * marks are positive (negative marking is inherently guess-suppressing).
 */
export const MIN_CORRECT_TO_INCORRECT_RATIO = 2;

type Num = number | null | undefined;
const isFiniteNum = (n: Num): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Coerce a partial/untrusted config (e.g. from an admin form or JSONB) into a
 * complete ContestScoringConfig, filling any missing/invalid field from the
 * default. Does NOT validate the anti-guessing rule — call
 * validateScoringConfig for that.
 */
export function normalizeScoringConfig(raw: unknown): ContestScoringConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => (isFiniteNum(v as Num) ? (v as number) : fallback);
  const partial = r.partialCreditPolicy === "none" ? "none" : "fractional";
  const negative = r.negativeMarkingMode === "all" ? "all" : "answered_only";
  return {
    correctMarks: num(r.correctMarks, DEFAULT_CONTEST_SCORING.correctMarks),
    incorrectMarks: num(r.incorrectMarks, DEFAULT_CONTEST_SCORING.incorrectMarks),
    unattemptedMarks: num(r.unattemptedMarks, DEFAULT_CONTEST_SCORING.unattemptedMarks),
    difficultyMultiplier: r.difficultyMultiplier === true,
    timeBonus: r.timeBonus === true,
    partialCreditPolicy: partial,
    negativeMarkingMode: negative,
  };
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Anti-guessing guardrail (plan §5). A correct answer must be worth strictly
 * more than a wrong attempt, and — when a wrong attempt still earns positive
 * marks — worth at least MIN_CORRECT_TO_INCORRECT_RATIO× as much, so random
 * guessing cannot dominate a real solve.
 */
export function validateScoringConfig(config: ContestScoringConfig): ValidationResult {
  if (!(config.correctMarks > 0)) {
    return { ok: false, error: "Correct answers must be worth more than 0 marks." };
  }
  if (!(config.correctMarks > config.incorrectMarks)) {
    return {
      ok: false,
      error: "Correct answers must be worth strictly more than incorrect attempts.",
    };
  }
  if (
    config.incorrectMarks > 0 &&
    config.correctMarks < config.incorrectMarks * MIN_CORRECT_TO_INCORRECT_RATIO
  ) {
    return {
      ok: false,
      error: `Correct answers must be worth at least ${MIN_CORRECT_TO_INCORRECT_RATIO}× an incorrect attempt so guessing cannot dominate.`,
    };
  }
  return { ok: true };
}

export interface ContestSchedule {
  regOpen: Date | null;
  regClose: Date | null;
  startAt: Date | null;
  endAt: Date | null;
}

/**
 * A publishable schedule needs all four instants, ordered:
 *   reg_open < reg_close ≤ start_at < end_at.
 * (Registration must close by the time the contest starts; the contest must
 * have positive duration.) All comparisons are over absolute instants.
 */
export function validateSchedule(schedule: ContestSchedule): ValidationResult {
  const { regOpen, regClose, startAt, endAt } = schedule;
  if (!regOpen || !regClose || !startAt || !endAt) {
    return { ok: false, error: "Registration window and start/end times are all required to publish." };
  }
  const [ro, rc, s, e] = [regOpen, regClose, startAt, endAt].map((d) => d.getTime());
  if ([ro, rc, s, e].some((t) => Number.isNaN(t))) {
    return { ok: false, error: "Schedule contains an invalid date." };
  }
  if (!(ro < rc)) return { ok: false, error: "Registration must open before it closes." };
  if (!(rc <= s)) return { ok: false, error: "Registration must close no later than the contest start." };
  if (!(s < e)) return { ok: false, error: "The contest must start before it ends." };
  return { ok: true };
}

/** Contest duration in whole seconds (end − start); 0 if either is unset/invalid. */
export function durationSeconds(startAt: Date | null, endAt: Date | null): number {
  if (!startAt || !endAt) return 0;
  const d = Math.floor((endAt.getTime() - startAt.getTime()) / 1000);
  return d > 0 ? d : 0;
}
