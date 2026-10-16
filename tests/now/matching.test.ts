/**
 * Origin NOW matching: who is in the pool, who is offered first, when the bot
 * takes over, and when a helper is restricted automatically.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BOT_RULE,
  decideDispatch,
  evaluateAutomaticReview,
  exclusionReason,
  isLowAcceptRate,
  istDayKey,
  rankCandidates,
  shouldWiden,
  type Candidate,
  type DispatchState,
  type MatchContext,
} from "@/server/now/matching";

const now = Date.parse("2026-10-16T14:00:00Z");

function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    helperId: id,
    userId: `user-${id}`,
    verified: true,
    agreementAccepted: true,
    lastSeenMs: now - 5_000,
    inLiveSession: false,
    blockedByStudent: false,
    excludedForRequest: false,
    alreadyOffered: false,
    linkedUserIds: [],
    sessionsWithStudentToday: 0,
    coversChapter: true,
    languages: ["english"],
    ratingAvg: 4.5,
    acceptRate: 0.8,
    medianAcceptMs: 8_000,
    sessionsToday: 2,
    isFavourite: false,
    lastUsedByStudentAt: null,
    ...overrides,
  };
}

const ctx: MatchContext = { studentId: "student-1", nowMs: now, language: "hindi", widened: false };

test("each exclusion rule removes a helper from the pool", () => {
  const cases: [Partial<Candidate>, string][] = [
    [{ verified: false }, "not_verified"],
    [{ agreementAccepted: false }, "no_agreement"],
    [{ lastSeenMs: now - 61_000 }, "offline"],
    [{ inLiveSession: true }, "busy"],
    [{ blockedByStudent: true }, "blocked"],
    [{ excludedForRequest: true }, "no_show_on_request"],
    [{ alreadyOffered: true }, "already_offered"],
    [{ userId: "student-1" }, "own_account"],
    [{ linkedUserIds: ["student-1"] }, "own_account"],
    [{ sessionsWithStudentToday: 3 }, "pair_cap"],
    [{ coversChapter: false }, "chapter"],
  ];
  for (const [overrides, reason] of cases) {
    assert.equal(exclusionReason(candidate("x", overrides), ctx), reason, reason);
  }
  assert.equal(exclusionReason(candidate("ok"), ctx), null);
});

test("widening drops only the chapter requirement", () => {
  assert.equal(exclusionReason(candidate("x", { coversChapter: false }), { ...ctx, widened: true }), null);
  assert.equal(shouldWiden(1), false);
  assert.equal(shouldWiden(2), true);
});

test("favourites, then recently used solvers, come before everyone else", () => {
  const ranked = rankCandidates(
    [
      candidate("best-rated", { ratingAvg: 5 }),
      candidate("recent", { ratingAvg: 3, lastUsedByStudentAt: now - 86_400_000 }),
      candidate("fav", { ratingAvg: 2, isFavourite: true }),
    ],
    ctx,
  );
  assert.deepEqual(ranked.map((c) => c.helperId), ["fav", "recent", "best-rated"]);
});

test("language match outranks a higher rating", () => {
  const ranked = rankCandidates(
    [candidate("english-48", { ratingAvg: 4.8 }), candidate("hindi-43", { ratingAvg: 4.3, languages: ["Hindi"] })],
    ctx,
  );
  assert.equal(ranked[0].helperId, "hindi-43");
});

test("after widening, exact-chapter helpers still come first", () => {
  const ranked = rankCandidates(
    [candidate("subject-only", { coversChapter: false, ratingAvg: 5 }), candidate("chapter", { ratingAvg: 4 })],
    { ...ctx, widened: true },
  );
  assert.deepEqual(ranked.map((c) => c.helperId), ["chapter", "subject-only"]);
});

test("ties fall through rating, accept rate, accept time, then fewest sessions today", () => {
  const ranked = rankCandidates(
    [
      candidate("slow", { medianAcceptMs: 20_000 }),
      candidate("busy-day", { sessionsToday: 9 }),
      candidate("fast", { medianAcceptMs: 3_000 }),
      candidate("unrated", { ratingAvg: null }),
    ],
    ctx,
  );
  assert.deepEqual(ranked.map((c) => c.helperId), ["fast", "busy-day", "slow", "unrated"]);
});

const waiting: DispatchState = {
  inHumanHours: true,
  eligibleHumans: 2,
  humansOnline: 3,
  failedOffers: 0,
  waitedMs: 0,
  callbackOffered: false,
};

test("outside human hours the bot takes the request, or it closes when the bot is off", () => {
  assert.deepEqual(decideDispatch({ ...waiting, inHumanHours: false }, DEFAULT_BOT_RULE), {
    action: "assign_bot",
    reason: "off_hours",
  });
  assert.deepEqual(decideDispatch({ ...waiting, inHumanHours: false }, { ...DEFAULT_BOT_RULE, enabled: false }), {
    action: "close_no_helper",
    detail: "none_online",
  });
});

test("nobody online sends the request straight to the bot", () => {
  assert.deepEqual(decideDispatch({ ...waiting, humansOnline: 0, eligibleHumans: 0 }, DEFAULT_BOT_RULE), {
    action: "assign_bot",
    reason: "none_online",
  });
});

test("the bot takes over after the admin-set declines or wait", () => {
  assert.equal(decideDispatch({ ...waiting, failedOffers: 3 }, DEFAULT_BOT_RULE).action, "assign_bot");
  assert.equal(decideDispatch({ ...waiting, waitedMs: 120_000 }, DEFAULT_BOT_RULE).action, "assign_bot");
  assert.equal(decideDispatch(waiting, DEFAULT_BOT_RULE).action, "offer_human");
});

test("with the bot off: call-back at 3 minutes, give up at 8", () => {
  const off = { ...DEFAULT_BOT_RULE, enabled: false };
  assert.equal(decideDispatch({ ...waiting, eligibleHumans: 0, waitedMs: 180_000 }, off).action, "offer_callback");
  assert.equal(
    decideDispatch({ ...waiting, eligibleHumans: 0, waitedMs: 180_000, callbackOffered: true }, off).action,
    "wait",
  );
  assert.deepEqual(decideDispatch({ ...waiting, waitedMs: 480_000 }, off), {
    action: "close_no_helper",
    detail: "all_busy",
  });
});

const dayKeyOf = istDayKey;

test("a low average over enough ratings restricts the helper", () => {
  const ratings = Array.from({ length: 10 }, (_, i) => ({ stars: i < 6 ? 3 : 4, tags: [], at: now - i * 3_600_000 }));
  const result = evaluateAutomaticReview({ recentRatings: ratings, upheldOrOpenReportTimes: [], nowMs: now, dayKeyOf });
  assert.equal(result.restrict, true);
});

test("one bad first rating does not restrict a new solver", () => {
  const result = evaluateAutomaticReview({
    recentRatings: [{ stars: 1, tags: [], at: now }],
    upheldOrOpenReportTimes: [],
    nowMs: now,
    dayKeyOf,
  });
  assert.equal(result.restrict, false);
});

test("two Not-resolved tags today or two reports in 30 days restrict", () => {
  const notResolved = evaluateAutomaticReview({
    recentRatings: [
      { stars: 4, tags: ["not_resolved"], at: now - 1_000 },
      { stars: 5, tags: ["not_resolved"], at: now - 2_000 },
    ],
    upheldOrOpenReportTimes: [],
    nowMs: now,
    dayKeyOf,
  });
  assert.equal(notResolved.restrict, true);
  const reports = evaluateAutomaticReview({
    recentRatings: [],
    upheldOrOpenReportTimes: [now - 86_400_000, now - 10 * 86_400_000],
    nowMs: now,
    dayKeyOf,
  });
  assert.equal(reports.restrict, true);
  const oldReports = evaluateAutomaticReview({
    recentRatings: [],
    upheldOrOpenReportTimes: [now - 40 * 86_400_000, now - 50 * 86_400_000],
    nowMs: now,
    dayKeyOf,
  });
  assert.equal(oldReports.restrict, false);
});

test("low accept rate is flagged only after 20 offers", () => {
  assert.equal(isLowAcceptRate(19, 1), false);
  assert.equal(isLowAcceptRate(20, 9), true);
  assert.equal(isLowAcceptRate(20, 10), false);
});

test("IST day keys roll over at IST midnight, not UTC midnight", () => {
  assert.equal(istDayKey(Date.parse("2026-10-16T18:29:00Z")), "2026-10-16");
  assert.equal(istDayKey(Date.parse("2026-10-16T18:31:00Z")), "2026-10-17");
});
