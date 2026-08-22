/**
 * Contest state machine — the single, pure, client-safe derivation of a
 * contest's current state from its persisted status + schedule windows.
 *
 * HYBRID MODEL (plan §2): a contest's lifecycle has two halves that never
 * overlap in time, so there is exactly one authoritative state per instant.
 *
 *   PRE-CLOSE   (status = 'scheduled')  → UPCOMING / LIVE / ENDED are DERIVED
 *                                          purely from NOW() vs the windows.
 *   POST-CLOSE  (status flags)          → RESULT_PROCESSING / RESULT_PUBLISHED /
 *                                          ARCHIVED are read straight off status.
 *   PRE-PUBLIC  (status = 'draft')      → DRAFT: the admin is still building it;
 *                                          it is not yet on the public machine.
 *
 * All time math is over absolute instants (Date / TIMESTAMPTZ), so it is
 * timezone- and DST-agnostic: the same instant yields the same state for every
 * viewer regardless of their local zone. `displayTz` is for formatting copy
 * only and is intentionally NOT an input here.
 *
 * This module is PURE and client-safe — it must never import server-only code,
 * because the register banner / countdown (client) and the API guards (server)
 * both derive state from it.
 */

/** Pre-close states, derived from the clock while status = 'scheduled'. */
export type ContestLiveState = "UPCOMING" | "LIVE" | "ENDED";

/** Post-close states, read straight off the persisted status flag. */
export type ContestPipelineState =
  | "RESULT_PROCESSING"
  | "RESULT_PUBLISHED"
  | "ARCHIVED"
  | "CANCELLED";

/** The full public state machine (plan §9/§16), plus DRAFT (pre-public). */
export type ContestState = "DRAFT" | ContestLiveState | ContestPipelineState;

/** The persisted `contest.contests.status` column (plan §2). */
export type ContestStatus =
  | "draft"
  | "scheduled"
  | "result_processing"
  | "result_published"
  | "archived"
  | "cancelled";

/**
 * Uniform grace applied to WRITE acceptance after end_at — a submit/autosave
 * whose server-receive time is within this window past end_at is still
 * accepted, so a request in flight at the exact rollover is not unfairly
 * dropped (plan Phase 4). It is a single server-wide constant applied
 * identically to every user; it does NOT extend the displayed deadline or the
 * ENDED state boundary. Mirrors CBT's FINALIZE_GRACE_SECONDS.
 */
export const CONTEST_END_GRACE_SECONDS = 10;

/** The schedule + status inputs the state machine needs. Nulls = not yet set. */
export interface ContestWindow {
  status: ContestStatus;
  regOpen: Date | null;
  regClose: Date | null;
  startAt: Date | null;
  endAt: Date | null;
}

function ms(d: Date | null): number | null {
  if (!d) return null;
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * The authoritative state of a contest at instant `now`.
 *
 * Post-close status flags WIN over time derivation: once the pipeline has
 * advanced a contest to result_processing/published/archived, that is its
 * state even though the clock is long past end_at. While status = 'scheduled'
 * the state is derived from the windows; a 'scheduled' contest whose end_at has
 * passed but whose pipeline has not yet flipped reads as ENDED (awaiting the
 * result-processing job).
 */
export function resolveContestState(window: ContestWindow, now: Date): ContestState {
  switch (window.status) {
    case "draft":
      return "DRAFT";
    case "result_processing":
      return "RESULT_PROCESSING";
    case "result_published":
      return "RESULT_PUBLISHED";
    case "archived":
      return "ARCHIVED";
    case "cancelled":
      return "CANCELLED";
    case "scheduled": {
      const t = now.getTime();
      const start = ms(window.startAt);
      const end = ms(window.endAt);
      // Missing windows on a scheduled contest are a misconfiguration; treat as
      // not-yet-live rather than throwing, so a half-built schedule can't 500
      // the banner. (Phase 0 publish-validation is what prevents this state.)
      if (start === null || end === null) return "UPCOMING";
      if (t < start) return "UPCOMING";
      if (t < end) return "LIVE";
      return "ENDED";
    }
    default: {
      // Exhaustiveness guard: a new status must be handled explicitly.
      const _never: never = window.status;
      return _never;
    }
  }
}

/**
 * Registration is open iff the contest is scheduled AND now ∈ [reg_open, end_at).
 * Late registration (walk-up) is allowed: a user who finds a LIVE contest can
 * register and immediately start on the reduced clock (canStartAttempt = LIVE).
 * reg_close is retained only as informational metadata — the true cutoff is
 * end_at. Fail-CLOSED: any missing window or wrong status ⇒ not open. Server-
 * checked against DB NOW().
 */
export function isRegistrationOpen(window: ContestWindow, now: Date): boolean {
  if (window.status !== "scheduled") return false;
  const t = now.getTime();
  const open = ms(window.regOpen);
  const end = ms(window.endAt);
  if (open === null || end === null) return false;
  if (t < open) return false;
  // Cannot register once the contest itself has ended.
  if (t >= end) return false;
  return true;
}

/**
 * A registered user may START an attempt iff the contest is LIVE. Late entry is
 * allowed (D5a): opening after start_at is fine, on a reduced clock bounded by
 * the same end_at — so the only gate is LIVE. (Registration + single-attempt
 * are enforced separately, server-side, fail-closed.)
 */
export function canStartAttempt(window: ContestWindow, now: Date): boolean {
  return resolveContestState(window, now) === "LIVE";
}

/**
 * Whether a write (autosave/submit) received at `now` is still acceptable: only
 * up to end_at + grace. Past that it is finalized to the last durable draft,
 * never graded (plan Phase 4). Pure; the authoritative clock is the caller's
 * (server DB NOW()).
 */
export function isWithinWriteGrace(window: ContestWindow, now: Date): boolean {
  const end = ms(window.endAt);
  if (end === null) return false;
  return now.getTime() <= end + CONTEST_END_GRACE_SECONDS * 1000;
}

/**
 * Display-only remaining seconds until end_at (never negative). For the client
 * countdown; the deadline is always the fixed end_at, so a late/ resumed user
 * simply sees a shorter clock (D5/D5a). Returns 0 when not LIVE or unset.
 */
export function remainingSeconds(window: ContestWindow, now: Date): number {
  if (resolveContestState(window, now) !== "LIVE") return 0;
  const end = ms(window.endAt);
  if (end === null) return 0;
  return Math.max(0, Math.floor((end - now.getTime()) / 1000));
}

/**
 * Anti-cheat: only a SUSTAINED backgrounding counts as a violation. Brief blurs
 * (notification pull-down, a quick app-switch, the mobile keyboard) fire
 * visibilitychange too, and counting them ejected legitimate mobile students.
 * A real "look something up" exit lasts well over this grace.
 */
export const VIOLATION_GRACE_MS = 2000;

/** True when a hidden span of `hiddenMs` should count as an anti-cheat strike. */
export function shouldCountViolation(hiddenMs: number): boolean {
  return hiddenMs >= VIOLATION_GRACE_MS;
}

/** True once results are visible to students (hard gate for result/answer reads). */
export function areResultsPublished(window: ContestWindow): boolean {
  return window.status === "result_published" || window.status === "archived";
}
