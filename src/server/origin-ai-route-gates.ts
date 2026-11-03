/**
 * Helpers for the origin-ai BFF route (src/app/api/origin-ai/[...slug]/route.ts):
 * the pre-proxy checks, the chapter-catalog cache rules and after-response
 * work. Kept here so they are unit tested without the route's DB / Redis /
 * microservice wiring.
 */

import { after } from "next/server";

import type { StoredUser } from "@/server/store";

/**
 * Runs independent gates (AI toggle, premium, rate limit) together instead of
 * one after another, and returns what the old sequential chain would have:
 * the first gate (in the order given) that refused or threw decides. A later
 * gate's refusal never masks an earlier one.
 */
export async function firstGateRefusal(
  gates: ReadonlyArray<Promise<Response | null>>,
): Promise<Response | null> {
  const settled = await Promise.allSettled(gates);
  for (const outcome of settled) {
    if (outcome.status === "rejected") throw outcome.reason;
    if (outcome.value) return outcome.value;
  }
  return null;
}

/**
 * The route's pre-proxy chain: the AI-toggle / premium gates run together
 * (firstGateRefusal), and the rate limit is taken only once they all pass, as
 * in the old sequential chain. A refused request (AI off, free student) never
 * uses up a rate-limit slot, so a student who subscribes right after a refusal
 * is not 429'd on their first real question.
 */
export async function gatesThenRateLimit(
  gates: ReadonlyArray<Promise<Response | null>>,
  rateLimit: (() => Promise<Response | null>) | null,
): Promise<Response | null> {
  const refusal = await firstGateRefusal(gates);
  if (refusal) return refusal;
  return rateLimit ? rateLimit() : null;
}

export const DAILY_AI_TOKEN_LIMIT = 200_000;
export const DAILY_VOICE_MINUTE_LIMIT = 10;

type UsageCounters = Pick<StoredUser, "tokensUsedToday" | "voiceMinutesUsedToday" | "usageResetAt">;

/**
 * Today's quota counters from an origin_users row, applying the same UTC-midnight
 * rule as dbUpdateUsageMetrics (`usage_reset_at < CURRENT_DATE` means the stored
 * counters are from an earlier day and count as 0). Read-only: the reset and the
 * yesterday snapshot are still written by the next real usage update.
 */
export function usageCountersForToday(
  user: UsageCounters,
  now: Date = new Date(),
): { tokensUsedToday: number; voiceMinutesUsedToday: number } {
  const resetAt = Date.parse(user.usageResetAt ?? "");
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (Number.isFinite(resetAt) && resetAt < startOfTodayUtc) {
    return { tokensUsedToday: 0, voiceMinutesUsedToday: 0 };
  }
  const tokens = Number(user.tokensUsedToday ?? 0);
  const voice = Number(user.voiceMinutesUsedToday ?? 0);
  return {
    tokensUsedToday: Number.isFinite(tokens) ? tokens : 0,
    voiceMinutesUsedToday: Number.isFinite(voice) ? voice : 0,
  };
}

/** Which daily limit (if any) refuses this request. */
export function usageLimitExceeded(
  user: UsageCounters,
  input: { voice?: boolean; pageKind?: string | null } = {},
  now: Date = new Date(),
): "tokens" | "voice" | null {
  const usage = usageCountersForToday(user, now);
  if (usage.tokensUsedToday >= DAILY_AI_TOKEN_LIMIT) return "tokens";
  if (input.voice && usage.voiceMinutesUsedToday >= DAILY_VOICE_MINUTE_LIMIT && input.pageKind !== "doubt_solver") {
    return "voice";
  }
  return null;
}

// The NCERT chapter catalog changes only when the KB is re-seeded, so a cached
// copy younger than this is served without calling the microservice.
export const CHAPTER_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

/** True for a microservice chapters payload worth caching / serving: `{ chapters: [...] }`, non-empty. */
export function isUsableChapterPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const chapters = (payload as { chapters?: unknown }).chapters;
  return Array.isArray(chapters) && chapters.length > 0;
}

/** A cached catalog row is fresh when it parses, is not from the future, and is younger than the TTL. */
export function isChapterCatalogFresh(
  cached: { payload: unknown; fetchedAt: string } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!cached || !isUsableChapterPayload(cached.payload)) return false;
  const fetchedAt = Date.parse(cached.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return false;
  const age = now - fetchedAt;
  // A small negative age is clock skew between Postgres and this instance.
  return age > -60_000 && age < CHAPTER_CATALOG_TTL_MS;
}

/**
 * Runs `task` after the response is sent (Next `after`, which keeps the
 * function alive for it on Vercel). Outside a request scope (unit tests,
 * scripts) it runs straight away without being awaited. Failures are logged,
 * never thrown: the caller has already answered.
 */
export function runAfterResponse(task: () => Promise<unknown>, label: string): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[origin-ai] ${label} failed`, error instanceof Error ? error.message : error);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
