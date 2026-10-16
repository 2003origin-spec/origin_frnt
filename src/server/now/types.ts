/**
 * Shared vocabulary for Origin NOW (live human / bot doubt solving paid in
 * Ori Coins). Plan: V1/ORIGIN_NOW_PLAN.md.
 *
 * Kept free of imports so the pure rule modules (session-state, matching,
 * pricing, ledger-rules) and their unit tests never pull in a DB client.
 */

/** OGCode's own difficulty labels; the session price is keyed on these. */
export const DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SOLVER_KINDS = ["human", "bot"] as const;
export type SolverKind = (typeof SOLVER_KINDS)[number];

export const REQUEST_STATUSES = [
  "requested",
  "offered",
  "accepted",
  "live",
  "ended",
  "rated",
  "cancelled",
  "no_helper",
  "no_show",
  "unrated",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CLOSED_REASONS = ["cancelled", "no_helper", "no_show"] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

export const CLOSED_DETAILS = ["all_busy", "none_online"] as const;
export type ClosedDetail = (typeof CLOSED_DETAILS)[number];

export const OUTCOMES = ["resolved", "partial", "unresolved"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** PRD §8 root-cause tags; optional on every session. */
export const ROOT_CAUSES = [
  "conceptual_gap",
  "calculation_error",
  "misread",
  "careless_error",
  "time_pressure",
  "other",
] as const;
export type RootCause = (typeof ROOT_CAUSES)[number];

/** PRD §9 student feedback tags. */
export const FEEDBACK_TAGS = [
  "clear_explanation",
  "fast_response",
  "strong_subject_knowledge",
  "friendly",
  "not_resolved",
] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export const DECLINE_REASONS = ["not_my_topic", "busy", "too_hard", "other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const HELPER_ROLES = ["teacher", "college_student", "school_student", "other"] as const;
export type HelperRole = (typeof HELPER_ROLES)[number];

export const HELPER_VERIFICATION_STATUSES = ["verified", "restricted", "rejected"] as const;
export type HelperVerificationStatus = (typeof HELPER_VERIFICATION_STATUSES)[number];

export const APPLICATION_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Timing constants from the plan doc's matching rules. */
export const OFFER_WINDOW_MS = 25_000;
export const PRESENCE_WINDOW_MS = 60_000;
export const NO_SHOW_WINDOW_MS = 2 * 60_000;
export const CALLBACK_OFFER_AFTER_MS = 3 * 60_000;
export const GIVE_UP_AFTER_MS = 8 * 60_000;
export const RATING_WINDOW_MS = 24 * 60 * 60_000;
export const ACCEPT_LOCK_SECONDS = 30;

/** Pilot caps (plan doc, matching step 8). */
export const STUDENT_DAILY_REQUEST_CAP = 3;
export const PAIR_DAILY_SESSION_CAP = 3;

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * OGCode stores difficulty as free text ("Easy", "insane", " Hard "). Returns
 * null for anything unrecognised so the caller refuses the request rather than
 * silently pricing it as some default.
 */
export function normalizeDifficulty(raw: unknown): Difficulty | null {
  if (typeof raw !== "string") return null;
  const lowered = raw.trim().toLowerCase();
  return isDifficulty(lowered) ? lowered : null;
}
