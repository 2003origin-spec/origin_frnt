/**
 * The Origin NOW request state machine — the ONLY place a request's `status`
 * may change (plan doc, "Session state machine in one place").
 *
 *   requested ─offer_sent→ offered ─offer_accepted→ accepted ─both_joined→ live
 *        ↑        │  ↑                    │                                 │
 *        └─offer_declined/expired         └─helper_no_show (loop back)      session_ended
 *                                                                           ↓
 *                                         rated ←rated─ ended ─rating_window_closed→ unrated
 *
 * Exits: cancelled (student leaves), no_helper (give up, bot off),
 * no_show (student never joined). `bot_assigned` jumps a waiting request
 * straight to `accepted` with the Origin bot as the solver.
 *
 * Pure: handlers call `transition()` and persist the result with a
 * conditional UPDATE on the previous status, so a racing second writer loses.
 */

import type { RequestStatus } from "./types";

export type RequestEvent =
  | "offer_sent"
  | "offer_declined"
  | "offer_expired"
  | "offer_accepted"
  | "bot_assigned"
  | "both_joined"
  | "helper_no_show"
  | "student_no_show"
  | "student_cancelled"
  | "give_up"
  | "session_ended"
  | "rated"
  | "rating_window_closed";

const TRANSITIONS: Record<RequestEvent, Partial<Record<RequestStatus, RequestStatus>>> = {
  offer_sent: { requested: "offered" },
  offer_declined: { offered: "requested" },
  offer_expired: { offered: "requested" },
  offer_accepted: { offered: "accepted" },
  bot_assigned: { requested: "accepted", offered: "accepted" },
  both_joined: { accepted: "live" },
  helper_no_show: { accepted: "requested" },
  student_no_show: { accepted: "no_show" },
  student_cancelled: { requested: "cancelled", offered: "cancelled", accepted: "cancelled" },
  give_up: { requested: "no_helper", offered: "no_helper" },
  session_ended: { live: "ended" },
  rated: { ended: "rated" },
  rating_window_closed: { ended: "unrated" },
};

const TERMINAL: ReadonlySet<RequestStatus> = new Set([
  "rated",
  "unrated",
  "cancelled",
  "no_helper",
  "no_show",
]);

/** Statuses in which a solver has not yet been secured; the coin hold is still open. */
const WAITING: ReadonlySet<RequestStatus> = new Set(["requested", "offered"]);

export type TransitionResult =
  | { ok: true; from: RequestStatus; to: RequestStatus }
  | { ok: false; from: RequestStatus; event: RequestEvent; error: string };

export function transition(from: RequestStatus, event: RequestEvent): TransitionResult {
  const to = TRANSITIONS[event][from];
  if (!to) {
    return { ok: false, from, event, error: `Cannot apply '${event}' to a request that is '${from}'.` };
  }
  return { ok: true, from, to };
}

export function canTransition(from: RequestStatus, event: RequestEvent): boolean {
  return TRANSITIONS[event][from] !== undefined;
}

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL.has(status);
}

export function isWaiting(status: RequestStatus): boolean {
  return WAITING.has(status);
}

/** Statuses a student counts as "one live request" against the cap. */
export function isOpen(status: RequestStatus): boolean {
  return !TERMINAL.has(status) && status !== "ended";
}

/**
 * What happens to the student's coin hold when a request reaches `status`.
 * `capture` is decided by the session's `payable` flag at session end, so an
 * `ended` request reports `decide_at_end`.
 */
export function holdDisposition(status: RequestStatus): "keep" | "release" | "decide_at_end" {
  switch (status) {
    case "cancelled":
    case "no_helper":
    case "no_show":
      return "release";
    case "ended":
    case "rated":
    case "unrated":
      return "decide_at_end";
    default:
      return "keep";
  }
}
