/**
 * Teacher-assigned test windows (`assessment.test_assignments.scheduled_start_at`
 * / `scheduled_end_at`).
 *
 * Pure rules shared by the server gate (detail + submit in src/legacy/assessments.ts)
 * and the student Tests list (which only DISPLAYS the state; the server decides).
 * The server always passes the database clock (`SELECT NOW()`) as `now`, so the
 * gate never depends on a client clock or on drift between app instances.
 *
 * Rules:
 *  - before `startsAt`  → "upcoming": listed, but questions are NOT served
 *                          (403 `test_not_started`) and submits are refused.
 *  - within the window  → "open": questions served, submits accepted. Both bounds
 *                          are inclusive; a null bound is unbounded.
 *  - after `endsAt`     → "ended": no new attempts (409 `test_ended`). A submit
 *                          still lands if its attempt STARTED inside the window
 *                          and it arrives within {@link TEST_WINDOW_SUBMIT_GRACE_SECONDS}
 *                          of `endsAt` — that covers the request a student fires
 *                          at 12:59:59 that reaches the server at 13:00:02.
 */

/**
 * Grace after `scheduled_end_at` for a submit whose attempt began inside the
 * window. Long enough for a slow mobile network or an auto-submit on the bell;
 * short enough that nobody can keep writing after the window closes.
 */
export const TEST_WINDOW_SUBMIT_GRACE_SECONDS = 60;

export type TestWindowPhase = "upcoming" | "open" | "ended";

export type TestWindowBounds = {
  startsAt: string | Date | null | undefined;
  endsAt: string | Date | null | undefined;
};

export type TestWindowErrorCode = "test_not_started" | "test_ended";

function toMillis(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Where `now` sits relative to the window. Both bounds inclusive; null = unbounded. */
export function testWindowPhase(window: TestWindowBounds, now: Date | string | number): TestWindowPhase {
  const nowMs = typeof now === "number" ? now : toMillis(now) ?? Date.now();
  const start = toMillis(window.startsAt);
  const end = toMillis(window.endsAt);
  if (start !== null && nowMs < start) return "upcoming";
  if (end !== null && nowMs > end) return "ended";
  return "open";
}

export type TestWindowDecision =
  | { ok: true; phase: TestWindowPhase; inGrace: boolean }
  | { ok: false; phase: TestWindowPhase; code: TestWindowErrorCode };

/**
 * May a student who already holds `attemptStartedAt` (null = no recorded attempt)
 * continue (reload the paper) or submit right now?
 *
 * Only an attempt that started INSIDE the window earns the post-end grace; an
 * attempt with no recorded start, or one started before the window opened, does not.
 */
export function canContinueTeacherTest(input: {
  window: TestWindowBounds;
  attemptStartedAt: string | Date | null | undefined;
  now: Date | string | number;
  graceSeconds?: number;
}): TestWindowDecision {
  const phase = testWindowPhase(input.window, input.now);
  if (phase === "upcoming") return { ok: false, phase, code: "test_not_started" };
  if (phase === "open") return { ok: true, phase, inGrace: false };

  const nowMs = typeof input.now === "number" ? input.now : toMillis(input.now) ?? Date.now();
  const start = toMillis(input.window.startsAt);
  const end = toMillis(input.window.endsAt) as number; // "ended" implies a non-null end
  const startedAt = toMillis(input.attemptStartedAt);
  const graceMs = Math.max(0, input.graceSeconds ?? TEST_WINDOW_SUBMIT_GRACE_SECONDS) * 1000;
  const startedInsideWindow =
    startedAt !== null && startedAt <= end && (start === null || startedAt >= start);
  if (startedInsideWindow && nowMs <= end + graceMs) {
    return { ok: true, phase, inGrace: true };
  }
  return { ok: false, phase, code: "test_ended" };
}

/** HTTP status for each refusal: 403 before start, 409 after end. */
export function testWindowErrorStatus(code: TestWindowErrorCode): 403 | 409 {
  return code === "test_not_started" ? 403 : 409;
}

/** A refusal raised by the teacher-test window gate; routes map it to JSON with `code`. */
export class TestWindowError extends Error {
  readonly status: 403 | 409;
  readonly code: TestWindowErrorCode;
  readonly startsAt: string | null;
  readonly endsAt: string | null;

  constructor(code: TestWindowErrorCode, window: { startsAt: string | null; endsAt: string | null }) {
    super(
      code === "test_not_started"
        ? "This test has not started yet."
        : "This test's window has closed. New attempts and submissions are no longer accepted.",
    );
    this.name = "TestWindowError";
    this.code = code;
    this.status = testWindowErrorStatus(code);
    this.startsAt = window.startsAt;
    this.endsAt = window.endsAt;
  }
}

/**
 * Structural check (not `instanceof`): the error may cross an `unstable_cache`
 * boundary or a bundler duplicate of this module.
 */
export function isTestWindowError(error: unknown): error is {
  message: string;
  status: 403 | 409;
  code: TestWindowErrorCode;
  startsAt: string | null;
  endsAt: string | null;
} {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "test_not_started" || code === "test_ended";
}

/**
 * The window end translated onto the CLIENT clock, from the database clock the
 * page was rendered with (`serverNow`) and the client time it arrived
 * (`clientNow`): `endsAt − (serverNow − clientNow)`. Null when the window has
 * no end (or the inputs are unusable), i.e. the duration alone bounds the sitting.
 */
export function windowDeadlineOnClientClock(input: {
  windowEndsAt: string | Date | null | undefined;
  serverNow: string | Date | null | undefined;
  clientNow: number;
}): number | null {
  const end = toMillis(input.windowEndsAt);
  if (end === null) return null;
  const server = toMillis(input.serverNow);
  // No server reading: trust the client clock rather than drop the cap.
  const skew = server === null ? 0 : server - input.clientNow;
  return end - skew;
}

/** The earlier of two client-clock deadlines; null means "no deadline". */
export function earliestDeadline(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * How long a student may sit, in whole seconds: the test duration, capped at
 * the time left before the window closes (`deadlineMs` on the client clock, see
 * {@link windowDeadlineOnClientClock}). The timer auto-submits at the cap, and
 * the server's {@link TEST_WINDOW_SUBMIT_GRACE_SECONDS} covers the network.
 */
export function cappedSittingSeconds(input: {
  durationSeconds: number;
  deadlineMs: number | null;
  nowMs: number;
}): number {
  const duration = Math.max(0, Math.floor(input.durationSeconds));
  if (input.deadlineMs === null) return duration;
  const left = Math.floor((input.deadlineMs - input.nowMs) / 1000);
  return Math.max(0, Math.min(duration, left));
}
