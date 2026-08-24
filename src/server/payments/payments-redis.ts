/**
 * Redis helpers for the payment path.
 *
 * IMPORTANT: nothing here is load-bearing for correctness. Redis is a latency
 * and contention optimisation only — every guarantee (no double charge, no
 * double grant, no double email) is enforced by a Postgres constraint. If
 * Upstash is down, evicts a key, or is not configured at all, the payment path
 * still behaves correctly; it just does more database work.
 *
 * That is a deliberate choice: an idempotency scheme whose safety depends on a
 * cache is not an idempotency scheme.
 *
 * Jobs Redis does here (payments plan D8):
 *   1. short-lived locks that serialise concurrent duplicate requests
 *   2. a cached copy of a completed idempotent response
 *   3. the pricing snapshot cache, invalidated on every admin write
 *   4. webhook event-id dedupe fast path
 */

import { Redis } from "@upstash/redis";

/** The subset of Upstash's client this module uses — lets tests inject a fake. */
export type PaymentsRedis = {
  get(key: string): Promise<unknown>;
  set(
    key: string,
    value: string,
    opts?: { nx?: boolean; ex?: number; px?: number },
  ): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  eval?(script: string, keys: string[], args: string[]): Promise<unknown>;
};

let client: PaymentsRedis | null | undefined;
let overridden = false;

function build(): PaymentsRedis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token }) as unknown as PaymentsRedis;
}

/** The Redis client, or null when Upstash is not configured. Never throws. */
export function getPaymentsRedis(): PaymentsRedis | null {
  if (overridden) return client ?? null;
  if (client === undefined) client = build();
  return client ?? null;
}

/** Test seam: inject a fake (or null to simulate an outage). */
export function __setPaymentsRedisForTests(fake: PaymentsRedis | null): void {
  client = fake;
  overridden = true;
}

/** Test seam: restore real resolution. */
export function __resetPaymentsRedisForTests(): void {
  client = undefined;
  overridden = false;
}

export const PAYMENTS_REDIS_PREFIX = "pay:";

function k(suffix: string): string {
  return `${PAYMENTS_REDIS_PREFIX}${suffix}`;
}

/**
 * Best-effort mutual exclusion. Returns a release token on success, null when
 * the lock is held OR when Redis is unavailable — callers MUST treat null as
 * "could not fast-path" and fall through to the durable Postgres path, never as
 * "someone else has it, abort".
 */
export async function acquireLock(name: string, ttlMs: number): Promise<string | null> {
  const redis = getPaymentsRedis();
  if (!redis) return null;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const res = await redis.set(k(`lock:${name}`), token, { nx: true, px: ttlMs });
    return res ? token : null;
  } catch (error) {
    console.error("[payments-redis] lock acquire failed; continuing without it", error);
    return null;
  }
}

/**
 * Releases a lock we hold. Compare-and-delete so a lock that already expired
 * and was re-taken by someone else is not deleted out from under them.
 */
export async function releaseLock(name: string, token: string): Promise<void> {
  const redis = getPaymentsRedis();
  if (!redis) return;
  try {
    if (typeof redis.eval === "function") {
      await redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        [k(`lock:${name}`)],
        [token],
      );
      return;
    }
    const current = await redis.get(k(`lock:${name}`));
    if (current === token) await redis.del(k(`lock:${name}`));
  } catch (error) {
    console.error("[payments-redis] lock release failed; it will expire on its own", error);
  }
}

/** Cache read. Returns null on miss, on a parse failure, or on any Redis error. */
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = getPaymentsRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(k(key));
    if (raw == null) return null;
    // Upstash auto-deserialises JSON; a raw string still needs a parse.
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    return raw as T;
  } catch (error) {
    console.error("[payments-redis] cache read failed; treating as a miss", error);
    return null;
  }
}

/** Cache write. Silently no-ops when Redis is unavailable. */
export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getPaymentsRedis();
  if (!redis) return;
  try {
    await redis.set(k(key), JSON.stringify(value), { ex: ttlSeconds });
  } catch (error) {
    console.error("[payments-redis] cache write failed; ignoring", error);
  }
}

/** Cache invalidation. Silently no-ops when Redis is unavailable. */
export async function cacheDelete(...keys: string[]): Promise<void> {
  const redis = getPaymentsRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys.map(k));
  } catch (error) {
    console.error("[payments-redis] cache delete failed; the TTL is the backstop", error);
  }
}

/**
 * Webhook dedupe fast path. Returns true when this event id has NOT been seen
 * in the TTL window (caller should process), false when it is a duplicate.
 *
 * Returns TRUE when Redis is unavailable — the caller must then rely on the
 * payments.events primary key, which is the actual guarantee. Failing "open"
 * here is right: a duplicate costs one wasted idempotent write, whereas failing
 * closed would silently drop a real event.
 */
export async function markEventSeen(eventId: string, ttlSeconds = 172_800): Promise<boolean> {
  const redis = getPaymentsRedis();
  if (!redis) return true;
  try {
    const res = await redis.set(k(`evt:${eventId}`), "1", { nx: true, ex: ttlSeconds });
    return Boolean(res);
  } catch (error) {
    console.error("[payments-redis] event dedupe failed; deferring to the DB ledger", error);
    return true;
  }
}
