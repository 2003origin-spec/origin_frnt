/**
 * All-time site-visit counter behind the landing "aspirants & counting" stat.
 *
 * A single Redis INCR key (`stats:site_visits`) bumped once per landing page
 * load. Best-effort: degrades to the baseline (or 0) without Upstash, and never
 * throws on the public request path.
 *
 * SITE_VISITS_BASELINE lets an operator seed a truthful historical starting
 * offset (e.g. from prior analytics) so the number isn't 0 at launch — it is
 * simply added to the live counter, never fabricated per-request.
 */
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const VISITS_KEY = 'stats:site_visits';

function baseline(): number {
  const raw = Number(process.env.SITE_VISITS_BASELINE ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** Increment the all-time visit counter by one. No-op without Redis. */
export async function recordSiteVisit(): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(VISITS_KEY);
  } catch {
    // best-effort ambient counter — never throw on the request path
  }
}

/** All-time visits = baseline + live counter. Falls back to baseline (or 0). */
export async function getSiteVisits(): Promise<number> {
  const base = baseline();
  if (!redis) return base;
  try {
    const n = await redis.get<number>(VISITS_KEY);
    return base + (typeof n === 'number' ? n : Number(n ?? 0));
  } catch {
    return base;
  }
}
