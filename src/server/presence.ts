/**
 * Global "active screens" presence — counts every open, authenticated app
 * screen (tab/device) worldwide for the landing "solving right now" counter.
 *
 * Heartbeat-based: each screen ZADDs `${userId}:${screenId}` into a Redis
 * sorted set scored by epoch-ms. The live count is the members seen within
 * SCREEN_WINDOW_MS; stale entries (closed tabs / crashes) age out on their own.
 * Keyed per-screen (not per-user) so two tabs = two screens.
 *
 * Best-effort: degrades to 0 / no-op without Upstash (local dev).
 */
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const SCREENS_KEY = 'presence:screens';
/** A heartbeat keeps a screen "active" this long (tolerates ~2 missed beats). */
export const SCREEN_WINDOW_MS = 150_000;
/** Abandoned-set cleanup: the key self-expires this long after the last write. */
const SCREENS_KEY_TTL_SECONDS = 600;

/** Record one active screen (member is a stable per-screen id). No-op w/o Redis. */
export async function recordScreenPresence(member: string): Promise<void> {
  if (!redis || !member) return;
  const now = Date.now();
  try {
    await redis.zadd(SCREENS_KEY, { score: now, member });
    await redis.zremrangebyscore(SCREENS_KEY, 0, now - SCREEN_WINDOW_MS);
    await redis.expire(SCREENS_KEY, SCREENS_KEY_TTL_SECONDS);
  } catch {
    // best-effort ambient signal — never throw
  }
}

/** Number of active screens worldwide within the window. 0 without Redis. */
export async function getActiveScreens(): Promise<number> {
  if (!redis) return 0;
  const now = Date.now();
  try {
    return await redis.zcount(SCREENS_KEY, now - SCREEN_WINDOW_MS, '+inf');
  } catch {
    return 0;
  }
}
