/**
 * Student-to-student messaging: the pure rules (no database, no Next.js).
 *
 * Contract: the shared messaging API contract (01/11/2026). Everything here is
 * deterministic so it can be unit tested on its own:
 *   - text checks and "units" (each message costs max(1, ceil(words / 10)));
 *   - the daily unit cap by IST day (free / premium, env-configurable);
 *   - the message-request state machine (who may send, accept, decline, block),
 *     and what an unblock restores;
 *   - admin suspensions (the 403 text) and report resolutions.
 */

import { formatISTDayDMY } from "@/lib/format-time";
import { istDayStartMs, istDateKeyFromMs, istEpochDayFromMs } from "@/lib/ist-day";

export const MESSAGE_MAX_CHARS = 500;
export const WORDS_PER_UNIT = 10;
export const DEFAULT_DAILY_UNITS_FREE = 10;
export const DEFAULT_DAILY_UNITS_PREMIUM = 40;
export const REPORT_NOTE_MAX_CHARS = 1000;
export const MESSAGE_PAGE_DEFAULT = 30;
export const MESSAGE_PAGE_MAX = 100;

export const REPORT_REASONS = ["spam", "abuse", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export type ConversationStatus = "pending" | "accepted" | "declined" | "blocked";

/** A domain refusal with the HTTP status, a stable `code` for the app and a student-readable `detail`. */
export class MessagingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = "MessagingError";
  }
}

// ── Text and units ──────────────────────────────────────────────────────────

/**
 * Clean a message for storage: drop NUL (Postgres TEXT rejects it) and trim the
 * ends. Throws `empty` / `too_long`. Length is counted in code points, so an
 * emoji is one character (the same count as Postgres `char_length`).
 */
export function normalizeMessageText(raw: unknown): string {
  const text = typeof raw === "string" ? raw.replace(/\u0000/g, "").trim() : "";
  if (!text) throw new MessagingError(400, "empty", "Write a message first.");
  if ([...text].length > MESSAGE_MAX_CHARS) {
    throw new MessagingError(400, "too_long", `Keep a message under ${MESSAGE_MAX_CHARS} characters.`);
  }
  return text;
}

/** Words = whitespace-separated tokens. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/** Units a message costs: max(1, ceil(words / 10)). */
export function messageUnits(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / WORDS_PER_UNIT));
}

// ── Daily cap by IST day ────────────────────────────────────────────────────

function positiveIntEnv(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Daily units for a student: MESSAGING_DAILY_UNITS_FREE (10) / MESSAGING_DAILY_UNITS_PREMIUM (40). */
export function dailyUnitLimit(premium: boolean, env: Record<string, string | undefined> = process.env): number {
  return premium
    ? positiveIntEnv(env, "MESSAGING_DAILY_UNITS_PREMIUM", DEFAULT_DAILY_UNITS_PREMIUM)
    : positiveIntEnv(env, "MESSAGING_DAILY_UNITS_FREE", DEFAULT_DAILY_UNITS_FREE);
}

/** The IST day a send at `nowMs` counts against (`YYYY-MM-DD`), and when it resets (next 00:00 IST, ISO). */
export function usageWindow(nowMs: number): { day: string; resetsAt: string } {
  return {
    day: istDateKeyFromMs(nowMs),
    resetsAt: new Date(istDayStartMs(istEpochDayFromMs(nowMs) + 1)).toISOString(),
  };
}

export type Usage = { used: number; limit: number; premium: boolean; resetsAt: string };

export function buildUsage(used: number, premium: boolean, nowMs: number, env?: Record<string, string | undefined>): Usage {
  return {
    used: Math.max(0, used),
    limit: dailyUnitLimit(premium, env),
    premium,
    resetsAt: usageWindow(nowMs).resetsAt,
  };
}

/** True when a message of `units` fits in what is left today. */
export function fitsDailyCap(used: number, units: number, limit: number): boolean {
  return used + units <= limit;
}

/** The 429 for a message that does not fit. */
export function dailyLimitError(usage: Usage, units: number): MessagingError {
  const left = Math.max(0, usage.limit - usage.used);
  const detail =
    left > 0
      ? `That message needs ${units} of your ${left} messages left today. Shorten it or wait until midnight.`
      : `You've used today's ${usage.limit} messages. More at midnight.`;
  return new MessagingError(429, "daily_limit", detail, { usage });
}

// ── The request state machine ───────────────────────────────────────────────

export type ConversationState = {
  status: ConversationStatus;
  /** The student who sent the first message (the request). */
  requestedBy: string;
};

/**
 * May `me` send a message in this conversation now? `implicitAccept` is true
 * when the recipient replies to a pending request: replying accepts it, like
 * pressing Accept first.
 */
export function sendDecision(state: ConversationState, me: string, otherName: string): { implicitAccept: boolean } {
  if (state.status === "blocked") throw new MessagingError(403, "blocked", "You can't message this student.");
  if (state.status === "accepted") return { implicitAccept: false };
  const iRequested = state.requestedBy === me;
  if (state.status === "pending") {
    if (iRequested) throw new MessagingError(409, "request_pending", `Wait for ${otherName} to accept your request.`);
    return { implicitAccept: true };
  }
  // declined
  if (iRequested) throw new MessagingError(409, "declined", `${otherName} didn't accept your request.`);
  throw new MessagingError(409, "declined", "You declined this request. Accept it to reply.");
}

export type ConversationAction = "accept" | "decline" | "block";

/**
 * The status after `me` takes `action`. Returns the same status for a no-op
 * repeat (accepting twice, declining twice). Throws for moves that are not
 * allowed: only the recipient accepts or declines; nothing reopens a block.
 */
export function nextStatus(
  state: ConversationState,
  me: string,
  action: ConversationAction,
  otherName: string,
): ConversationStatus {
  if (action === "block") return "blocked";
  if (state.status === "blocked") throw new MessagingError(403, "blocked", "You can't message this student.");
  const iRequested = state.requestedBy === me;
  if (iRequested) {
    if (state.status === "accepted") return "accepted";
    if (state.status === "declined") throw new MessagingError(409, "declined", `${otherName} didn't accept your request.`);
    throw new MessagingError(409, "request_pending", `Wait for ${otherName} to accept your request.`);
  }
  if (action === "accept") return "accepted";
  // decline: only a pending (or already declined) request; an accepted chat stays as it is.
  return state.status === "accepted" ? "accepted" : "declined";
}

/** Pair key: the two ids in a fixed order, so one pair has one conversation. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ── Block / unblock ─────────────────────────────────────────────────────────

/** The status to remember when a block replaces `current` (a second block keeps the first one's memory). */
export function statusToRemember(current: ConversationStatus, remembered: ConversationStatus | null): ConversationStatus | null {
  return current === "blocked" ? remembered : current;
}

/**
 * The status after one student lifts their block. While the other student
 * still blocks them it stays `blocked`; otherwise it goes back to what the
 * block replaced (accepted or pending), or `declined` when nothing was saved.
 */
export function statusAfterUnblock(
  current: ConversationStatus,
  remembered: ConversationStatus | null,
  otherStillBlocks: boolean,
): ConversationStatus {
  if (otherStillBlocks) return "blocked";
  if (current !== "blocked") return current;
  return remembered && remembered !== "blocked" ? remembered : "declined";
}

// ── Admin: suspensions and report resolutions ───────────────────────────────

export const SUSPEND_DAYS_MIN = 1;
export const SUSPEND_DAYS_MAX = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORT_ACTIONS = ["dismiss", "warn", "suspend"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export function isReportAction(value: unknown): value is ReportAction {
  return typeof value === "string" && (REPORT_ACTIONS as readonly string[]).includes(value);
}

/** Whole days 1..90, or null. */
export function parseSuspendDays(value: unknown): number | null {
  const days = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof days === "number" && Number.isInteger(days) && days >= SUSPEND_DAYS_MIN && days <= SUSPEND_DAYS_MAX ? days : null;
}

/** When a suspension of `days` starting at `nowMs` ends. */
export function suspensionEndsAt(nowMs: number, days: number): Date {
  return new Date(nowMs + days * DAY_MS);
}

/** "Messaging is paused on your account until 05/11/2026." (the IST calendar day it ends). */
export function suspensionDetail(endsAt: Date | string): string {
  return `Messaging is paused on your account until ${formatISTDayDMY(endsAt)}.`;
}

/** The 403 a suspended student gets on start / send. */
export function suspendedError(endsAt: Date | string): MessagingError {
  return new MessagingError(403, "suspended", suspensionDetail(endsAt));
}

/** Stored report status for a resolution (the API shows open | resolved). */
export function storedReportStatus(action: ReportAction): "dismissed" | "reviewed" {
  return action === "dismiss" ? "dismissed" : "reviewed";
}
