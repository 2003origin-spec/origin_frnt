/**
 * Contest single-active-session registry (plan Phase 3). One active writer per
 * (contest, user): when a user opens the contest in a new tab/device, that
 * session becomes the sole authoritative writer and older sessions are evicted
 * (their next autosave is rejected). This is the multi-tab / multi-device
 * consistency guard — the CBT token_version trick re-keyed to the authenticated
 * user's JWT session id (sid).
 *
 * The registry stores the current sid per (contest, user) in Redis with a TTL
 * bounded to the contest window. In dev (no Redis) an in-memory map is used.
 * Fail-OPEN on a Redis blip: an outage must not lock a user out of their own
 * attempt — the DB single-attempt PK + rev-LWW still prevent corruption.
 */

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

const SESSION_TTL_SECONDS = 6 * 60 * 60; // generous upper bound on a contest window

const localSessions = new Map<string, string>();

function sessionKey(contestId: string, userId: string): string {
  return `contest:${contestId}:session:${userId}`;
}

/**
 * Claim the active session for (contest, user). Called on start/resume — the
 * caller's sid becomes THE active writer, evicting any older one. Idempotent for
 * the same sid.
 */
export async function claimActiveSession(contestId: string, userId: string, sid: string): Promise<void> {
  const key = sessionKey(contestId, userId);
  try {
    if (redis) {
      await redis.set(key, sid, { ex: SESSION_TTL_SECONDS });
      return;
    }
    if (canUseLocalFallback()) localSessions.set(key, sid);
  } catch {
    /* fail-open: a set failure just means the guard is temporarily lax */
  }
}

/**
 * Whether `sid` is the active session for (contest, user). Fail-OPEN: returns
 * true when the registry is unreachable OR unset (no claim yet), so a Redis
 * outage never blocks a legitimate write.
 */
export async function isActiveSession(contestId: string, userId: string, sid: string): Promise<boolean> {
  const key = sessionKey(contestId, userId);
  try {
    if (redis) {
      const current = (await redis.get(key)) as string | null;
      return current === null || current === sid;
    }
    if (canUseLocalFallback()) {
      const current = localSessions.get(key);
      return current === undefined || current === sid;
    }
  } catch {
    return true; // fail-open
  }
  return true;
}

/** Test-only: reset the in-memory fallback. */
export function __resetSessionRegistryForTests(): void {
  localSessions.clear();
}
