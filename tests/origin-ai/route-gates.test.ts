import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAPTER_CATALOG_TTL_MS,
  DAILY_AI_TOKEN_LIMIT,
  firstGateRefusal,
  gatesThenRateLimit,
  isChapterCatalogFresh,
  isUsableChapterPayload,
  runAfterResponse,
  usageCountersForToday,
  usageLimitExceeded,
} from "../../src/server/origin-ai-route-gates";

const refuse = (status: number) => new Response(null, { status });
const later = <T>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const laterReject = (error: Error, ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(error), ms));

test("firstGateRefusal: all gates pass -> null", async () => {
  assert.equal(await firstGateRefusal([Promise.resolve(null), later(null, 5), Promise.resolve(null)]), null);
  assert.equal(await firstGateRefusal([]), null);
});

test("firstGateRefusal: the earliest gate in order wins, not the fastest", async () => {
  const response = await firstGateRefusal([later(refuse(403), 20), Promise.resolve(refuse(429))]);
  assert.equal(response?.status, 403);
});

test("firstGateRefusal: a later refusal is returned when the earlier gates pass", async () => {
  const response = await firstGateRefusal([Promise.resolve(null), later(null, 5), Promise.resolve(refuse(429))]);
  assert.equal(response?.status, 429);
});

test("firstGateRefusal: an earlier gate's error is thrown, like the old sequential chain", async () => {
  await assert.rejects(
    firstGateRefusal([laterReject(new Error("redis down"), 10), Promise.resolve(refuse(429))]),
    /redis down/,
  );
});

test("firstGateRefusal: an earlier refusal masks a later gate's error", async () => {
  const response = await firstGateRefusal([Promise.resolve(refuse(403)), laterReject(new Error("db down"), 5)]);
  assert.equal(response?.status, 403);
});

test("firstGateRefusal: gates run concurrently", async () => {
  const started = Date.now();
  await firstGateRefusal([later(null, 40), later(null, 40), later(null, 40)]);
  assert.ok(Date.now() - started < 100, "gates ran one after another");
});

function countingLimiter(result: Response | null = null) {
  const limiter = { calls: 0, take: async () => { limiter.calls += 1; return result; } };
  return limiter;
}

test("gatesThenRateLimit: a refused gate never takes a rate-limit slot", async () => {
  const limiter = countingLimiter();
  const response = await gatesThenRateLimit([Promise.resolve(null), Promise.resolve(refuse(403))], limiter.take);
  assert.equal(response?.status, 403);
  assert.equal(limiter.calls, 0);
});

test("gatesThenRateLimit: a gate error is thrown and the limiter is not called", async () => {
  const limiter = countingLimiter();
  await assert.rejects(gatesThenRateLimit([laterReject(new Error("redis down"), 5)], limiter.take), /redis down/);
  assert.equal(limiter.calls, 0);
});

test("gatesThenRateLimit: the limiter runs once after all gates pass and its refusal is returned", async () => {
  const limiter = countingLimiter(refuse(429));
  const response = await gatesThenRateLimit([later(null, 5), Promise.resolve(null)], limiter.take);
  assert.equal(response?.status, 429);
  assert.equal(limiter.calls, 1);
});

test("gatesThenRateLimit: all pass -> null; no limiter or no gates is fine", async () => {
  const limiter = countingLimiter();
  assert.equal(await gatesThenRateLimit([Promise.resolve(null)], limiter.take), null);
  assert.equal(limiter.calls, 1);
  assert.equal(await gatesThenRateLimit([Promise.resolve(null)], null), null);
  assert.equal(await gatesThenRateLimit([], null), null);
});

const NOW = new Date("2026-11-03T10:00:00.000Z");

test("usageCountersForToday: counters reset today are taken as-is", () => {
  assert.deepEqual(
    usageCountersForToday({ tokensUsedToday: 1200, voiceMinutesUsedToday: 2.5, usageResetAt: "2026-11-03T00:00:01.000Z" }, NOW),
    { tokensUsedToday: 1200, voiceMinutesUsedToday: 2.5 },
  );
});

test("usageCountersForToday: counters from an earlier UTC day count as 0", () => {
  assert.deepEqual(
    usageCountersForToday({ tokensUsedToday: 250_000, voiceMinutesUsedToday: 30, usageResetAt: "2026-11-02T23:59:59.999Z" }, NOW),
    { tokensUsedToday: 0, voiceMinutesUsedToday: 0 },
  );
});

test("usageCountersForToday: exactly UTC midnight is today (not < CURRENT_DATE)", () => {
  assert.deepEqual(
    usageCountersForToday({ tokensUsedToday: 7, voiceMinutesUsedToday: 1, usageResetAt: "2026-11-03T00:00:00.000Z" }, NOW),
    { tokensUsedToday: 7, voiceMinutesUsedToday: 1 },
  );
});

test("usageCountersForToday: IST morning before 05:30 is still the previous UTC day", () => {
  // 03/11/2026 04:00 IST = 02/11/2026 22:30 UTC: a reset at 21:00 UTC that day is still current.
  const istEarlyMorning = new Date("2026-11-02T22:30:00.000Z");
  assert.equal(
    usageCountersForToday({ tokensUsedToday: 99, voiceMinutesUsedToday: 0, usageResetAt: "2026-11-02T21:00:00.000Z" }, istEarlyMorning).tokensUsedToday,
    99,
  );
});

test("usageCountersForToday: an unparsable reset time keeps the stored counters (fails closed)", () => {
  assert.equal(
    usageCountersForToday({ tokensUsedToday: 300_000, voiceMinutesUsedToday: 0, usageResetAt: "not a date" }, NOW).tokensUsedToday,
    300_000,
  );
});

test("usageCountersForToday: missing / non-numeric counters read as 0", () => {
  assert.deepEqual(
    usageCountersForToday(
      { tokensUsedToday: Number.NaN, voiceMinutesUsedToday: undefined as unknown as number, usageResetAt: NOW.toISOString() },
      NOW,
    ),
    { tokensUsedToday: 0, voiceMinutesUsedToday: 0 },
  );
});

const today = NOW.toISOString();

test("usageLimitExceeded: token limit is inclusive at 200k", () => {
  const user = { tokensUsedToday: DAILY_AI_TOKEN_LIMIT, voiceMinutesUsedToday: 0, usageResetAt: today };
  assert.equal(usageLimitExceeded(user, {}, NOW), "tokens");
  assert.equal(usageLimitExceeded({ ...user, tokensUsedToday: DAILY_AI_TOKEN_LIMIT - 1 }, {}, NOW), null);
});

test("usageLimitExceeded: voice limit applies only to voice requests outside the doubt solver", () => {
  const user = { tokensUsedToday: 0, voiceMinutesUsedToday: 10, usageResetAt: today };
  assert.equal(usageLimitExceeded(user, {}, NOW), null);
  assert.equal(usageLimitExceeded(user, { voice: true }, NOW), "voice");
  assert.equal(usageLimitExceeded(user, { voice: true, pageKind: "doubt_solver" }, NOW), null);
  assert.equal(usageLimitExceeded({ ...user, voiceMinutesUsedToday: 9.99 }, { voice: true }, NOW), null);
});

test("usageLimitExceeded: yesterday's exhausted budget does not block today", () => {
  const user = { tokensUsedToday: 500_000, voiceMinutesUsedToday: 60, usageResetAt: "2026-11-02T08:00:00.000Z" };
  assert.equal(usageLimitExceeded(user, { voice: true }, NOW), null);
});

const CHAPTERS = { subject: "phy", chapters: [{ id: "phy-1", name: "Units and Measurement" }] };
const NOW_MS = Date.parse("2026-11-03T10:00:00.000Z");

test("isUsableChapterPayload: only a non-empty chapters array counts", () => {
  assert.equal(isUsableChapterPayload(CHAPTERS), true);
  assert.equal(isUsableChapterPayload({ chapters: [] }), false);
  assert.equal(isUsableChapterPayload({}), false);
  assert.equal(isUsableChapterPayload({ raw: "<html>" }), false);
  assert.equal(isUsableChapterPayload(null), false);
  assert.equal(isUsableChapterPayload("chapters"), false);
});

test("isChapterCatalogFresh: younger than the TTL is fresh, older is stale", () => {
  const fresh = { payload: CHAPTERS, fetchedAt: new Date(NOW_MS - 60_000).toISOString() };
  const edge = { payload: CHAPTERS, fetchedAt: new Date(NOW_MS - CHAPTER_CATALOG_TTL_MS).toISOString() };
  const old = { payload: CHAPTERS, fetchedAt: new Date(NOW_MS - 2 * CHAPTER_CATALOG_TTL_MS).toISOString() };
  assert.equal(isChapterCatalogFresh(fresh, NOW_MS), true);
  assert.equal(isChapterCatalogFresh(edge, NOW_MS), false);
  assert.equal(isChapterCatalogFresh(old, NOW_MS), false);
});

test("isChapterCatalogFresh: accepts pg's String(Date) form of fetched_at", () => {
  const fetchedAt = String(new Date(NOW_MS - 5 * 60_000));
  assert.equal(isChapterCatalogFresh({ payload: CHAPTERS, fetchedAt }, NOW_MS), true);
});

test("isChapterCatalogFresh: unusable payload, bad timestamp, far-future timestamp or no row is not fresh", () => {
  const recent = new Date(NOW_MS - 1000).toISOString();
  assert.equal(isChapterCatalogFresh({ payload: {}, fetchedAt: recent }, NOW_MS), false);
  assert.equal(isChapterCatalogFresh({ payload: CHAPTERS, fetchedAt: "garbage" }, NOW_MS), false);
  assert.equal(isChapterCatalogFresh({ payload: CHAPTERS, fetchedAt: new Date(NOW_MS + 3_600_000).toISOString() }, NOW_MS), false);
  assert.equal(isChapterCatalogFresh({ payload: CHAPTERS, fetchedAt: new Date(NOW_MS + 5_000).toISOString() }, NOW_MS), true);
  assert.equal(isChapterCatalogFresh(null, NOW_MS), false);
  assert.equal(isChapterCatalogFresh(undefined, NOW_MS), false);
});

test("runAfterResponse: outside a request scope the task still runs, and its failure is swallowed", async () => {
  let ran = 0;
  runAfterResponse(async () => {
    ran += 1;
  }, "probe");
  runAfterResponse(async () => {
    throw new Error("boom");
  }, "probe failure");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(ran, 1);
});
