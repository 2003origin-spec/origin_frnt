/**
 * Pure rules for a connected session (plan doc, "Coin ledger invariants" →
 * "A payable session is defined in code", and the no-show rule).
 */

import { NO_SHOW_WINDOW_MS, type Outcome, type SolverKind } from "./types";

/** An extension request the solver has not confirmed within this window lapses. */
export const EXTENSION_REQUEST_TTL_MS = 60_000;

/** Sessions shorter than this still pay out but are flagged for admin review. */
export const SHORT_SESSION_MS = 2 * 60_000;

/** Grace before the sweep force-ends a session whose timer was missed. */
export const OVERRUN_GRACE_MS = 30_000;

export type PayableInput = {
  solverKind: SolverKind;
  studentJoined: boolean;
  helperJoined: boolean;
  /** Helper's outcome; bot sessions have none. */
  outcome: Outcome | null;
  /** The student is the helper's own or an admin-linked account. */
  ownOrLinkedAccount: boolean;
  openReport: boolean;
};

/**
 * Only a payable session moves the held coins to the solver; anything else
 * releases them back to the student.
 */
export function decidePayable(input: PayableInput): boolean {
  if (!input.studentJoined || !input.helperJoined) return false;
  if (input.ownOrLinkedAccount || input.openReport) return false;
  if (input.solverKind === "bot") return true;
  return input.outcome !== null;
}

/** Who failed to show up once the join window has passed, if anyone. */
export function noShowSide(input: {
  acceptedAt: Date;
  studentJoinedAt: Date | null;
  helperJoinedAt: Date | null;
  now: Date;
}): "helper" | "student" | "none" | "not_yet" {
  if (input.studentJoinedAt && input.helperJoinedAt) return "none";
  if (input.now.getTime() - input.acceptedAt.getTime() < NO_SHOW_WINDOW_MS) return "not_yet";
  // A helper who accepted and vanished is the case the plan protects the
  // student from: the request goes back to the queue. Only when the helper is
  // there and the student is not does the request close as no_show.
  if (!input.helperJoinedAt) return "helper";
  return "student";
}

export function isShortSession(startedAt: Date | null, endedAt: Date): boolean {
  return startedAt !== null && endedAt.getTime() - startedAt.getTime() < SHORT_SESSION_MS;
}

export function sessionEndsAt(startedAt: Date, minutes: number): Date {
  return new Date(startedAt.getTime() + minutes * 60_000);
}

export function isExtensionRequestOpen(requestedAt: Date | null, now: Date): boolean {
  return requestedAt !== null && now.getTime() - requestedAt.getTime() <= EXTENSION_REQUEST_TTL_MS;
}

/** First name only — what a solver ever sees of a student (plan doc, "Dashboards / privacy"). */
export function firstNameOnly(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 30) : "Student";
}
