/**
 * OGCode "Live Practicing" presence (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §12).
 *
 * Heartbeat-based, mirroring the Teacher Live Rooms approach: a per-question
 * Redis sorted set keyed by user, scored by last-heartbeat epoch-ms. The live
 * count is the members seen within PRESENCE_WINDOW_MS — stale entries age out
 * on their own (a closed tab / crash needs no explicit "leave"). A key TTL
 * bounds abandoned sets.
 *
 * Degrades to 0 / no-op when Upstash env is absent (local dev) — presence is
 * best-effort ambient signal, never load-bearing.
 */

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/** A heartbeat is "live" for this long after it lands. */
export const PRESENCE_WINDOW_MS = 40_000;
/** Abandoned-set cleanup: the key self-expires this long after the last write. */
const PRESENCE_KEY_TTL_SECONDS = 120;
/** Defensive cap so a pathological batch read can't fan out unbounded. */
const MAX_BATCH_QUESTIONS = 100;

export function isOgcodePresenceAvailable(): boolean {
  return redis !== null;
}

function presenceKey(questionId: string): string {
  return `ogcode:presence:${questionId}`;
}

/** Global set of everyone on any OGCode screen right now (for totals/peak). */
const GLOBAL_PRESENCE_KEY = "ogcode:presence:global";
/** Platform-wide "active now" set read by the landing live-counter. */
const APP_ACTIVE_KEY = "presence:active";
/** The landing counter treats a heartbeat as active for 5 minutes. */
const APP_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

/** Add a user to the global OGCode set + the platform active set (shared helper). */
async function touchGlobalPresence(userId: string, now: number): Promise<void> {
  if (!redis) return;
  await redis.zadd(GLOBAL_PRESENCE_KEY, { score: now, member: userId });
  await redis.zremrangebyscore(GLOBAL_PRESENCE_KEY, 0, now - PRESENCE_WINDOW_MS);
  await redis.expire(GLOBAL_PRESENCE_KEY, PRESENCE_KEY_TTL_SECONDS);
  await redis.zadd(APP_ACTIVE_KEY, { score: now, member: userId });
  await redis.zremrangebyscore(APP_ACTIVE_KEY, 0, now - APP_ACTIVE_WINDOW_MS);
}

/**
 * Record that a user is on an OGCode screen (the list/main page) without being
 * on a specific question. Feeds the global OGCode count + platform active set,
 * so "present but not solving" still counts. No-op without Redis.
 */
export async function recordOgcodeScreenPresence(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await touchGlobalPresence(userId, Date.now());
  } catch {
    // best-effort
  }
}

/**
 * Record that `userId` is actively on `questionId` right now. Also prunes
 * entries older than the window so the set stays small, and refreshes the
 * key TTL. No-op without Redis.
 */
export async function recordOgcodePresence(userId: string, questionId: string): Promise<void> {
  if (!redis) return;
  const key = presenceKey(questionId);
  const now = Date.now();
  try {
    await redis.zadd(key, { score: now, member: userId });
    await redis.zremrangebyscore(key, 0, now - PRESENCE_WINDOW_MS);
    await redis.expire(key, PRESENCE_KEY_TTL_SECONDS);
    // Mirror into the global OGCode set (totals/peak) + platform active set.
    await touchGlobalPresence(userId, now);
  } catch {
    // Presence is best-effort; a Redis hiccup must never break the question view.
  }
}

/** Total distinct students practicing any OGCode question right now. 0 without Redis. */
export async function getOgcodeTotalLivePresence(): Promise<number> {
  if (!redis) return 0;
  const now = Date.now();
  try {
    return await redis.zcount(GLOBAL_PRESENCE_KEY, now - PRESENCE_WINDOW_MS, "+inf");
  } catch {
    return 0;
  }
}

/** Live count for one question (members within the window). 0 without Redis. */
export async function getOgcodePresenceCount(questionId: string): Promise<number> {
  if (!redis) return 0;
  const now = Date.now();
  try {
    return await redis.zcount(presenceKey(questionId), now - PRESENCE_WINDOW_MS, "+inf");
  } catch {
    return 0;
  }
}

/**
 * Batch live counts for many questions (list cards) in one pipeline. Returns a
 * map of questionId → count; absent/zero questions may be omitted. Empty map
 * without Redis.
 */
export async function getOgcodePresenceCounts(questionIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(questionIds.filter(Boolean))].slice(0, MAX_BATCH_QUESTIONS);
  if (!redis || !ids.length) return out;
  const now = Date.now();
  try {
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.zcount(presenceKey(id), now - PRESENCE_WINDOW_MS, "+inf");
    }
    const results = (await pipeline.exec()) as (number | null)[];
    ids.forEach((id, i) => {
      const count = Number(results[i] ?? 0);
      if (count > 0) out.set(id, count);
    });
  } catch {
    // Best-effort; cards simply show no live badge on a Redis hiccup.
  }
  return out;
}
