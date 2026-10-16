/**
 * Origin NOW matching and dispatch rules — pure functions over plain data
 * (plan doc, "Matching and dispatch rules"). The service layer loads
 * candidates from Redis presence + Postgres and asks these functions what to
 * do; nothing here touches I/O, so every rule has a unit test.
 */

import {
  CALLBACK_OFFER_AFTER_MS,
  GIVE_UP_AFTER_MS,
  PAIR_DAILY_SESSION_CAP,
  PRESENCE_WINDOW_MS,
  type FeedbackTag,
} from "./types";

export type Candidate = {
  helperId: string;
  userId: string;
  verified: boolean;
  agreementAccepted: boolean;
  lastSeenMs: number;
  inLiveSession: boolean;
  /** This student has blocked the helper. */
  blockedByStudent: boolean;
  /** Excluded after a no-show on this same request. */
  excludedForRequest: boolean;
  alreadyOffered: boolean;
  /** Accounts admin has tied to this helper; never matched to them. */
  linkedUserIds: readonly string[];
  /** Completed sessions with this student today (pilot cap: 3). */
  sessionsWithStudentToday: number;
  /** Has expertise for the request's exact chapter (or the whole subject). */
  coversChapter: boolean;
  languages: readonly string[];
  /** Average stars over the last 30 counted ratings; null with no ratings yet. */
  ratingAvg: number | null;
  /** Accept rate over the last 30 offers; null with no offers yet. */
  acceptRate: number | null;
  medianAcceptMs: number | null;
  sessionsToday: number;
  isFavourite: boolean;
  /** Last completed session with this student, ms epoch; null if never. */
  lastUsedByStudentAt: number | null;
};

export type MatchContext = {
  studentId: string;
  nowMs: number;
  language: string | null;
  /** True after two failed offers: drop the chapter requirement. */
  widened: boolean;
  /** Solvers used within this window count as "recent". */
  recentWindowMs?: number;
};

const DEFAULT_RECENT_WINDOW_MS = 30 * 24 * 60 * 60_000;

export type ExclusionReason =
  | "not_verified"
  | "no_agreement"
  | "offline"
  | "busy"
  | "blocked"
  | "no_show_on_request"
  | "already_offered"
  | "own_account"
  | "pair_cap"
  | "chapter";

/** Why a candidate is out of the pool, or null when eligible (step 2). */
export function exclusionReason(c: Candidate, ctx: MatchContext): ExclusionReason | null {
  if (!c.verified) return "not_verified";
  if (!c.agreementAccepted) return "no_agreement";
  if (ctx.nowMs - c.lastSeenMs > PRESENCE_WINDOW_MS) return "offline";
  if (c.inLiveSession) return "busy";
  if (c.blockedByStudent) return "blocked";
  if (c.excludedForRequest) return "no_show_on_request";
  if (c.alreadyOffered) return "already_offered";
  if (c.userId === ctx.studentId || c.linkedUserIds.includes(ctx.studentId)) return "own_account";
  if (c.sessionsWithStudentToday >= PAIR_DAILY_SESSION_CAP) return "pair_cap";
  if (!ctx.widened && !c.coversChapter) return "chapter";
  return null;
}

function speaks(c: Candidate, language: string | null): boolean {
  if (!language) return false;
  const want = language.trim().toLowerCase();
  return c.languages.some((l) => l.trim().toLowerCase() === want);
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Step 3 ranking: favourite → recently used → exact chapter → language →
 * rating → accept rate → median accept time → fewest sessions today → id.
 * Unrated newcomers sort after rated helpers inside the same tier but are
 * never excluded, so new solvers still get offers.
 */
export function rankCandidates(candidates: readonly Candidate[], ctx: MatchContext): Candidate[] {
  const recentWindow = ctx.recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS;
  const isRecent = (c: Candidate) =>
    c.lastUsedByStudentAt !== null && ctx.nowMs - c.lastUsedByStudentAt <= recentWindow;

  return candidates
    .filter((c) => exclusionReason(c, ctx) === null)
    .slice()
    .sort((a, b) => {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
      const ra = isRecent(a);
      const rb = isRecent(b);
      if (ra !== rb) return ra ? -1 : 1;
      if (ra && rb && a.lastUsedByStudentAt !== b.lastUsedByStudentAt) {
        return (b.lastUsedByStudentAt ?? 0) - (a.lastUsedByStudentAt ?? 0);
      }
      if (a.coversChapter !== b.coversChapter) return a.coversChapter ? -1 : 1;
      const la = speaks(a, ctx.language);
      const lb = speaks(b, ctx.language);
      if (la !== lb) return la ? -1 : 1;
      return (
        compareNullableDesc(a.ratingAvg, b.ratingAvg) ||
        compareNullableDesc(a.acceptRate, b.acceptRate) ||
        compareNullableAsc(a.medianAcceptMs, b.medianAcceptMs) ||
        a.sessionsToday - b.sessionsToday ||
        a.helperId.localeCompare(b.helperId)
      );
    });
}

// ---------------------------------------------------------------------------
// Dispatch decision (steps 1, 6, 7).

export type BotRule = {
  /** Bot switched on for this subject. */
  enabled: boolean;
  /** Hand to the bot at once when no human is online. */
  whenNoneOnline: boolean;
  /** Hand to the bot after this many declined/expired offers (null = never by count). */
  afterFailedOffers: number | null;
  /** Hand to the bot after this long waiting (null = never by time). */
  afterMs: number | null;
};

export const DEFAULT_BOT_RULE: BotRule = {
  enabled: true,
  whenNoneOnline: true,
  afterFailedOffers: 3,
  afterMs: 2 * 60_000,
};

export type DispatchState = {
  /** Within human open hours. */
  inHumanHours: boolean;
  /** Ranked, eligible humans right now. */
  eligibleHumans: number;
  /** Any human online for the subject at all (before per-request exclusions). */
  humansOnline: number;
  failedOffers: number;
  waitedMs: number;
  callbackOffered: boolean;
};

export type DispatchDecision =
  | { action: "offer_human" }
  | { action: "assign_bot"; reason: "off_hours" | "none_online" | "after_failed_offers" | "after_wait" }
  | { action: "close_no_helper"; detail: "none_online" | "all_busy" }
  | { action: "offer_callback" }
  | { action: "wait" };

export function decideDispatch(state: DispatchState, bot: BotRule): DispatchDecision {
  const botOn = bot.enabled;
  if (!state.inHumanHours) {
    return botOn ? { action: "assign_bot", reason: "off_hours" } : { action: "close_no_helper", detail: "none_online" };
  }
  if (state.humansOnline === 0) {
    if (botOn && bot.whenNoneOnline) return { action: "assign_bot", reason: "none_online" };
    if (!botOn) return { action: "close_no_helper", detail: "none_online" };
  }
  if (botOn && bot.afterFailedOffers !== null && state.failedOffers >= bot.afterFailedOffers) {
    return { action: "assign_bot", reason: "after_failed_offers" };
  }
  if (botOn && bot.afterMs !== null && state.waitedMs >= bot.afterMs) {
    return { action: "assign_bot", reason: "after_wait" };
  }
  if (!botOn && state.waitedMs >= GIVE_UP_AFTER_MS) {
    return { action: "close_no_helper", detail: "all_busy" };
  }
  if (state.eligibleHumans > 0) return { action: "offer_human" };
  if (!botOn && !state.callbackOffered && state.waitedMs >= CALLBACK_OFFER_AFTER_MS) {
    return { action: "offer_callback" };
  }
  return { action: "wait" };
}

/** Step 6: after two failed offers the chapter filter is dropped. */
export function shouldWiden(failedOffers: number): boolean {
  return failedOffers >= 2;
}

// ---------------------------------------------------------------------------
// Automatic review (step 9) and the cherry-picking flag (step 10).

export type ReviewLimits = {
  minRatings: number;
  window: number;
  minAverage: number;
  notResolvedPerDay: number;
  reportsPer30Days: number;
};

export const DEFAULT_REVIEW_LIMITS: ReviewLimits = {
  // A single bad first rating must not restrict a new solver.
  minRatings: 5,
  window: 10,
  minAverage: 3.5,
  notResolvedPerDay: 2,
  reportsPer30Days: 2,
};

export type ReviewInput = {
  /** Most recent first. */
  recentRatings: readonly { stars: number; tags: readonly FeedbackTag[]; at: number }[];
  upheldOrOpenReportTimes: readonly number[];
  nowMs: number;
  /** Calendar-day key (IST) for "today", e.g. "2026-10-16". */
  dayKeyOf: (ms: number) => string;
};

export type ReviewResult = { restrict: boolean; reasons: string[] };

export function evaluateAutomaticReview(input: ReviewInput, limits: ReviewLimits = DEFAULT_REVIEW_LIMITS): ReviewResult {
  const reasons: string[] = [];
  const window = input.recentRatings.slice(0, limits.window);
  if (window.length >= limits.minRatings) {
    const avg = window.reduce((sum, r) => sum + r.stars, 0) / window.length;
    if (avg < limits.minAverage) {
      reasons.push(`Average ${avg.toFixed(2)} stars over the last ${window.length} rated sessions is under ${limits.minAverage}.`);
    }
  }
  const today = input.dayKeyOf(input.nowMs);
  const notResolvedToday = input.recentRatings.filter(
    (r) => r.tags.includes("not_resolved") && input.dayKeyOf(r.at) === today,
  ).length;
  if (notResolvedToday >= limits.notResolvedPerDay) {
    reasons.push(`${notResolvedToday} "Not resolved" tags today.`);
  }
  const thirtyDaysAgo = input.nowMs - 30 * 24 * 60 * 60_000;
  const recentReports = input.upheldOrOpenReportTimes.filter((t) => t >= thirtyDaysAgo).length;
  if (recentReports >= limits.reportsPer30Days) {
    reasons.push(`${recentReports} reports in the last 30 days.`);
  }
  return { restrict: reasons.length > 0, reasons };
}

/** Step 10: below 50% accept rate after 20 offers → flag for a conversation. */
export function isLowAcceptRate(offers: number, accepted: number): boolean {
  return offers >= 20 && accepted / offers < 0.5;
}

/** IST calendar day for caps and the "today" rules (India-only product). */
export function istDayKey(ms: number): string {
  return new Date(ms + 5.5 * 60 * 60_000).toISOString().slice(0, 10);
}
