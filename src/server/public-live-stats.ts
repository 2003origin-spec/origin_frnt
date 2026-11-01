/**
 * Landing-page "live stats" (visits / questions conquered / active streaks).
 *
 * The endpoint is unauthenticated and polled every 15 s by every open landing
 * tab, while two of the three numbers are full-table aggregates (an
 * unindexable JSON-cast scan of `app.streaks` and a SUM over the OGCode bank).
 * So the computed payload is memoised for 30 s in Redis (shared by every
 * serverless instance), or in-process when Redis is not configured / errors.
 * Concurrent misses on one instance share a single in-flight computation.
 */
import { Redis } from '@upstash/redis';

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from '@/server/postgres';
import { getSiteVisits } from '@/server/site-stats';
import { getUserPostgresPool, isUserPostgresConfigured } from '@/server/user-postgres';

export type LiveStats = { visits: number; questionsSolved: number; streaksActive: number };

export const LIVE_STATS_CACHE_KEY = 'public:live-stats';
export const LIVE_STATS_TTL_SECONDS = 30;

/** The subset of the Upstash client this module needs (fakeable in tests). */
export type LiveStatsRedis = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
};

declare global {
  // undefined = resolve from env; null = force "no Redis"; object = override.
  var __originLiveStatsRedis: LiveStatsRedis | null | undefined;
  var __originLiveStatsMemo: { value: LiveStats; expiresAt: number } | undefined;
  var __originLiveStatsInflight: Promise<LiveStats> | undefined;
}

let envRedis: LiveStatsRedis | null | undefined;

function redisClient(): LiveStatsRedis | null {
  if (globalThis.__originLiveStatsRedis !== undefined) return globalThis.__originLiveStatsRedis;
  if (envRedis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    envRedis = url && token ? (new Redis({ url, token }) as unknown as LiveStatsRedis) : null;
  }
  return envRedis;
}

/**
 * All-time "questions conquered" — total correct first-attempts across the whole
 * OGCode question bank. `first_attempt_correct` is a per-question aggregate
 * maintained by the engagement tracker, so SUM() is the real platform-wide total.
 */
async function questionsConquered(): Promise<number> {
  if (!isOgcodePostgresConfigured()) return 0;
  const pool = getOgcodePostgresPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ total: number | string }>(
      `SELECT COALESCE(SUM(first_attempt_correct), 0) AS total FROM ogcode_questions`,
    );
    return Number(res.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

/** Real active-streak count — users whose streak is alive (studied today/yesterday). */
async function streaksActive(): Promise<number> {
  if (!isUserPostgresConfigured()) return 0;
  const pool = getUserPostgresPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM app.streaks
        WHERE COALESCE((data->>'currentStreak')::int, 0) >= 1
          AND (data->>'lastStudyDate') IS NOT NULL
          AND (data->>'lastStudyDate')::date >= (CURRENT_DATE - INTERVAL '1 day')`,
    );
    return Number(res.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function computeLiveStats(): Promise<LiveStats> {
  const [visits, questionsSolved, streaks] = await Promise.all([
    getSiteVisits(),
    questionsConquered(),
    streaksActive(),
  ]);
  return { visits, questionsSolved, streaksActive: streaks };
}

function isLiveStats(value: unknown): value is LiveStats {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.visits === 'number' &&
    typeof v.questionsSolved === 'number' &&
    typeof v.streaksActive === 'number'
  );
}

async function computeShared(): Promise<LiveStats> {
  if (!globalThis.__originLiveStatsInflight) {
    globalThis.__originLiveStatsInflight = computeLiveStats().finally(() => {
      globalThis.__originLiveStatsInflight = undefined;
    });
  }
  return globalThis.__originLiveStatsInflight;
}

async function fromProcessMemo(now: number): Promise<LiveStats> {
  const memo = globalThis.__originLiveStatsMemo;
  if (memo && memo.expiresAt > now) return memo.value;
  const value = await computeShared();
  globalThis.__originLiveStatsMemo = { value, expiresAt: now + LIVE_STATS_TTL_SECONDS * 1000 };
  return value;
}

/** Live stats, recomputed at most once per 30 s (fleet-wide with Redis). */
export async function getPublicLiveStats(now: number = Date.now()): Promise<LiveStats> {
  const redis = redisClient();
  if (!redis) return fromProcessMemo(now);

  try {
    const cached = await redis.get<LiveStats>(LIVE_STATS_CACHE_KEY);
    if (isLiveStats(cached)) return cached;
  } catch {
    // Redis unreachable — degrade to the per-instance memo.
    return fromProcessMemo(now);
  }

  const value = await computeShared();
  try {
    await redis.set(LIVE_STATS_CACHE_KEY, value, { ex: LIVE_STATS_TTL_SECONDS });
  } catch {
    // best-effort
  }
  return value;
}
