/**
 * Contest approximate registered-count (plan Phase 1, §1.2).
 *
 * The register banner (Phase 2) shows a live "N registered" number to every
 * viewer. That MUST NOT be an exact `COUNT(*)` per viewer — a pre-contest surge
 * of 1M viewers would melt the primary. Instead we keep a Redis HyperLogLog per
 * contest: O(1) PFADD on registration, O(1) PFCOUNT for the (approximate) total,
 * with a short in-process cache so a burst of banner reads collapses to one
 * Redis call per instance per window.
 *
 * This counter is DISPLAY-ONLY and fail-open: a Redis blip returns a cached or
 * zero value, never an error. The AUTHORITATIVE "is this user registered"
 * eligibility check is a separate exact row read at take-time (fail-closed).
 */

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** How long a read is cached in-process before re-hitting Redis. */
const COUNT_CACHE_TTL_MS = 5_000;

// In-memory dev fallback: an exact set per contest (dev volumes are tiny).
const localSets = new Map<string, Set<string>>();
// In-process read cache (both Redis + fallback paths use it).
const readCache = new Map<string, { value: number; expiresAt: number }>();

function hllKey(contestId: string): string {
  return `contest:${contestId}:registered:hll`;
}

/**
 * Record a registration in the approximate counter. Idempotent by construction
 * (HLL PFADD of the same userId doesn't change the estimate). Best-effort:
 * a failure here never blocks the real registration write.
 */
export async function recordRegistration(contestId: string, userId: string): Promise<void> {
  readCache.delete(contestId); // let the next read reflect the new member
  try {
    if (redis) {
      await redis.pfadd(hllKey(contestId), userId);
      return;
    }
    if (canUseLocalFallback()) {
      const set = localSets.get(contestId) ?? new Set<string>();
      set.add(userId);
      localSets.set(contestId, set);
    }
  } catch {
    // display-only counter — swallow (the exact registrations row is the source
    // of truth; a missed PFADD only makes the banner count slightly low).
  }
}

/**
 * Approximate number of registrations for a contest. Cached in-process for
 * COUNT_CACHE_TTL_MS. Fail-open: returns the last cached value (or 0) on error.
 */
export async function getApproxRegisteredCount(contestId: string): Promise<number> {
  const cached = readCache.get(contestId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  let value = cached?.value ?? 0;
  try {
    if (redis) {
      value = Number(await redis.pfcount(hllKey(contestId))) || 0;
    } else if (canUseLocalFallback()) {
      value = localSets.get(contestId)?.size ?? 0;
    }
  } catch {
    // keep the stale cached value on error (fail-open).
  }
  readCache.set(contestId, { value, expiresAt: now + COUNT_CACHE_TTL_MS });
  return value;
}

/** Test-only: reset the in-memory fallback + read cache between cases. */
export function __resetContestCountsForTests(): void {
  localSets.clear();
  readCache.clear();
}
