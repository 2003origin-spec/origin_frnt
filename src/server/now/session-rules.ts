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
  /** A report by the student about this session was upheld. */
  reportUpheld: boolean;
};

/**
 * Only a payable session moves the held coins to the solver; anything else
 * releases them back to the student.
 */
export function decidePayable(input: PayableInput): boolean {
  if (!input.studentJoined || !input.helperJoined) return false;
  if (input.ownOrLinkedAccount || input.reportUpheld) return false;
  if (input.solverKind === "bot") return true;
  return input.outcome !== null;
}

/**
 * What the reports on a session mean for its money. Only reports BY THE
 * STUDENT (about the solver) count: a solver who reports an abusive student
 * must not lose their pay for it. An open one defers settlement until the
 * case closes; an upheld one makes the session unpayable.
 */
export function settlementReportState(
  reports: readonly { reporterRole: string | null; status: string }[],
): "clear" | "defer" | "upheld" {
  const fromStudent = reports.filter((r) => r.reporterRole === "student");
  if (fromStudent.some((r) => r.status === "open")) return "defer";
  if (fromStudent.some((r) => r.status === "upheld")) return "upheld";
  return "clear";
}

/**
 * The sweep's "ended but not settled" batch. Oldest first, so a backlog drains
 * in order, and never a session with an open student report: those are
 * deferred until the case closes (settlementReportState), and with a plain
 * LIMIT they would fill every batch and stall settlement for everyone else.
 * $1 = the rating-window cutoff.
 */
export function unsettledSessionsSql(limit: number): string {
  return `SELECT s.id FROM now.sessions s
      WHERE s.ended_at IS NOT NULL AND s.settled_at IS NULL
        AND (s.solver_kind = 'bot' OR s.outcome IS NOT NULL OR s.ended_at <= $1)
        AND NOT EXISTS (
          SELECT 1 FROM now.reports rp
           WHERE rp.session_id = s.id AND rp.reporter_role = 'student' AND rp.status = 'open'
        )
      ORDER BY s.ended_at ASC
      LIMIT ${Math.max(1, Math.floor(limit))}`;
}

/** Who failed to show up once the join window has passed, if anyone. */
export function noShowSide(input: {
  acceptedAt: Date;
  studentJoinedAt: Date | null;
  helperJoinedAt: Date | null;
  now: Date;
}): "helper" | "student" | "both" | "none" | "not_yet" {
  if (input.studentJoinedAt && input.helperJoinedAt) return "none";
  if (input.now.getTime() - input.acceptedAt.getTime() < NO_SHOW_WINDOW_MS) return "not_yet";
  // A helper who accepted and vanished while the student waited is the case
  // the plan protects the student from: the request goes back to the queue.
  // If the student never came either, nobody is waiting: close it (no charge)
  // rather than ring another solver for an empty room.
  if (!input.helperJoinedAt && !input.studentJoinedAt) return "both";
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
