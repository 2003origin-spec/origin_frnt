/**
 * Redis set of CONFIRMED registrations (`contest:{id}:registered:v2`) — a
 * read-through cache for the hot paper gate so the start_at burst does not hit
 * Neon once per student. Neon stays authoritative.
 *
 * Invariant (bug-fix C2): only `status = 'registered'` rows are ever SADDed, and
 * a removed registration is SREMed, so a HIT is safe to trust. Waitlisted users
 * and unregistered users are never members.
 *
 * Kept in its own module so the registration, access (waitlist promotion) and
 * participant-action services can share it without an import cycle.
 */

import { Redis } from "@upstash/redis";

/** The subset of the Upstash client this cache uses (lets tests inject a fake). */
export interface RegisteredSetRedis {
  sadd(key: string, member: string): Promise<unknown>;
  srem(key: string, member: string): Promise<unknown>;
  sismember(key: string, member: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

let redis: RegisteredSetRedis | null =
  redisUrl && redisToken
    ? (new Redis({ url: redisUrl, token: redisToken }) as unknown as RegisteredSetRedis)
    : null;

export const REGISTERED_SET_TTL_SECONDS = 3 * 24 * 60 * 60; // outlives any contest

/**
 * `:v2` (review L5): the pre-C2 code SADDed WAITLISTED users into the old
 * `contest:{id}:registered` set and never removed anyone, so a hit there is not
 * trustworthy. The new key starts empty and is only ever filled by this
 * module (confirmed seats; a miss reads Neon and self-heals), so no manual DEL
 * of the old sets is needed at deploy. The old keys expire on their own TTL.
 */
export function registeredSetKey(contestId: string): string {
  return `contest:${contestId}:registered:v2`;
}

/** True when the Redis cache is configured (fast path available). */
export function hasRegisteredSetCache(): boolean {
  return redis !== null;
}

/** Best-effort SADD of a CONFIRMED seat; never blocks the real write. */
export async function cacheRegistration(contestId: string, userId: string): Promise<void> {
  if (!redis) return;
  try {
    const key = registeredSetKey(contestId);
    await redis.sadd(key, userId);
    await redis.expire(key, REGISTERED_SET_TTL_SECONDS);
  } catch {
    /* cache is advisory — a miss just falls through to Neon */
  }
}

/** SREM on unregister / account deletion so a stale HIT can't keep paper access. */
export async function uncacheRegistration(contestId: string, userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.srem(registeredSetKey(contestId), userId);
  } catch {
    /* advisory — the set expires on its own TTL */
  }
}

/** Fast-path membership check. `null` = unknown (no Redis / Redis error). */
export async function isCachedRegistration(contestId: string, userId: string): Promise<boolean | null> {
  if (!redis) return null;
  try {
    return (await redis.sismember(registeredSetKey(contestId), userId)) === 1;
  } catch {
    return null;
  }
}

/** Test-only: inject a fake Redis (or `null` for the no-Redis path). */
export function __setRegisteredSetRedisForTests(fake: RegisteredSetRedis | null): void {
  redis = fake;
}
