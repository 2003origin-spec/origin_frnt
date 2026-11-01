/**
 * Contest submit flow — the pure, client-safe ordering/retry/deadline rules
 * behind the attempt hook's submit and the server's submit/autosave gates.
 * Extracted so they can be unit-tested without rendering React or hitting a DB.
 *
 *  - runFinalSaveThenSubmit: flush the last autosave (forced, past the
 *    "submitting" guard) BEFORE submitting, retrying a failed save, then submit
 *    carrying the final draft either way (the server applies it under the same
 *    rev CAS as /answers).
 *  - isContestWriteOpen: the single write deadline (end_at + grace) for
 *    autosaves and the submit-carried final draft.
 *  - resolveFinalizeReason: a manual submit that lands after the deadline is
 *    recorded truthfully as a deadline finalize (never rejected).
 */

import { isWithinWriteGrace } from "./contest-state";

/** Mirrors the server's FinalizeReason (kept here so this module stays client-safe). */
export type FinalizeReasonInput = "manual" | "auto" | "deadline";

/** How many times the final autosave is attempted before submitting anyway. */
export const FINAL_SAVE_ATTEMPTS = 3;

/** Short linear backoff between final-save attempts (ms). */
export function finalSaveBackoffMs(attemptIndex: number): number {
  return 400 * (attemptIndex + 1);
}

export interface FinalSaveOutcome {
  /** True when one of the forced flushes was acknowledged by the server. */
  saved: boolean;
  /** The rev the submit-carried `final` draft should use. */
  rev: number;
}

export interface FinalSaveThenSubmitDeps<R> {
  /** Forced autosave flush; resolves with the rev it sent, rejects on failure. */
  flush: (opts: { force: true }) => Promise<number>;
  /** A fresh rev strictly above anything sent so far (used when every flush failed). */
  bumpRev: () => number;
  /** The actual submit, given the outcome of the final save. */
  submit: (outcome: FinalSaveOutcome) => Promise<R>;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Flush the final autosave (up to `attempts` tries, short backoff between),
 * then submit. The submit ALWAYS runs: a save that never landed is carried in
 * the submit body instead, under a bumped rev so the server's CAS accepts it.
 */
export async function runFinalSaveThenSubmit<R>(deps: FinalSaveThenSubmitDeps<R>): Promise<R> {
  const attempts = Math.max(1, deps.attempts ?? FINAL_SAVE_ATTEMPTS);
  const sleep = deps.sleep ?? defaultSleep;
  let savedRev: number | null = null;
  for (let i = 0; i < attempts && savedRev === null; i += 1) {
    try {
      savedRev = await deps.flush({ force: true });
    } catch {
      if (i < attempts - 1) await sleep(finalSaveBackoffMs(i));
    }
  }
  if (savedRev !== null) return deps.submit({ saved: true, rev: savedRev });
  return deps.submit({ saved: false, rev: deps.bumpRev() });
}

/**
 * Whether a contest write (autosave or the submit-carried final draft) received
 * at `now` is still accepted: up to end_at + CONTEST_END_GRACE_SECONDS. A
 * missing end_at is fail-closed (no write window).
 */
export function isContestWriteOpen(endAt: Date | string | null, now: Date): boolean {
  const end = endAt == null ? null : new Date(endAt);
  return isWithinWriteGrace({ status: "scheduled", regOpen: null, regClose: null, startAt: null, endAt: end }, now);
}

/**
 * The finalize reason actually recorded. A manual submit received after
 * end_at + grace is finalized as a deadline submit (graded from the draft, as
 * the sweep would), never rejected. Other reasons pass through unchanged.
 */
export function resolveFinalizeReason(
  reason: FinalizeReasonInput,
  endAt: Date | string | null,
  serverNow: Date,
): FinalizeReasonInput {
  if (reason !== "manual" || endAt == null) return reason;
  return isContestWriteOpen(endAt, serverNow) ? reason : "deadline";
}

export type SubmitPlan =
  | { kind: "refuse"; detail: "session_superseded" }
  | {
      kind: "submit";
      /** Apply the submit-carried `final` draft (only the active session may). */
      writeFinal: boolean;
      reason: "manual" | "auto";
      violationCount: number | undefined;
      malpractice: boolean;
    };

/**
 * How /api/contest/submit treats a submit, given whether the caller is the
 * active session for the attempt.
 *
 * A superseded session (an old phone tab after the student moved to a laptop)
 * may still close the attempt with a plain submit, graded from the active
 * session's draft. It must never carry anti-cheat flags onto the live attempt:
 * its strikes were counted on a tab nobody is using any more, so
 *  - a malpractice submit from it is refused (409 session_superseded), so the
 *    live attempt is neither closed nor flagged;
 *  - a plain submit is finalized without its violation count.
 */
export function planContestSubmit(input: {
  activeSession: boolean;
  malpractice?: boolean;
  violationCount?: number;
}): SubmitPlan {
  if (!input.activeSession) {
    if (input.malpractice) return { kind: "refuse", detail: "session_superseded" };
    return { kind: "submit", writeFinal: false, reason: "manual", violationCount: undefined, malpractice: false };
  }
  const malpractice = input.malpractice === true;
  return {
    kind: "submit",
    writeFinal: true,
    // A malpractice submit is still an "auto" close (3rd-strike auto-submit),
    // not a voluntary manual one.
    reason: malpractice ? "auto" : "manual",
    violationCount: input.violationCount,
    malpractice,
  };
}
