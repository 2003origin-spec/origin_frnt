/**
 * Idempotency for money-moving endpoints (payments plan D8, edge cases E1–E3).
 *
 * The problem: a student double-taps "Pay", or the network retries a POST, and
 * two Razorpay orders get created for one intent. Stripe's contract is the
 * industry answer and is what this implements:
 *
 *   • The client sends an `Idempotency-Key` header.
 *   • The FIRST request with that key runs and its response is stored.
 *   • A repeat with the SAME key and SAME body replays the stored response.
 *   • A repeat with the same key but a DIFFERENT body is a client bug → 422.
 *   • A repeat while the first is still running → 409, retry shortly.
 *
 * Correctness lives in Postgres: `payments.idempotency_keys` has the key as its
 * PRIMARY KEY, so the "who goes first" race is settled by the database, not by
 * a cache. Redis only shortens the path — see payments-redis.ts.
 *
 * Stale-claim recovery: a request that dies after claiming a key would otherwise
 * wedge it until the 24h expiry, permanently blocking that key for the user.
 * A claim older than IN_FLIGHT_TAKEOVER_SECONDS is therefore taken over.
 */

import crypto from "node:crypto";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensurePaymentsSchema } from "./payments-schema";
import { acquireLock, cacheGetJson, cacheSetJson, releaseLock } from "./payments-redis";

/** How long a claimed-but-unfinished key is respected before takeover. */
export const IN_FLIGHT_TAKEOVER_SECONDS = 90;

/** How long a completed response is replayable. Matches the row's expires_at. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** Redis lock hold time — comfortably longer than any Razorpay call. */
const LOCK_TTL_MS = 30_000;

export class IdempotencyConflictError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
    this.status = status;
  }
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * Deterministic JSON for hashing: object keys sorted at every depth, so
 * `{a:1,b:2}` and `{b:2,a:1}` hash identically. Without this, a client that
 * serialises its body in a different key order on retry would be told its
 * idempotency key was reused with different parameters.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`).join(",")}}`;
}

export function hashRequest(endpoint: string, body: unknown): string {
  return crypto.createHash("sha256").update(`${endpoint}\n${stableStringify(body)}`).digest("hex");
}

/**
 * A client-supplied key must be bounded and printable — it becomes a database
 * primary key and a Redis key. Returns null when the header is absent.
 */
export function normalizeIdempotencyKey(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.length > 200) {
    throw new IdempotencyConflictError(400, "Idempotency-Key must be 200 characters or fewer.");
  }
  if (!/^[\w.:-]+$/.test(value)) {
    throw new IdempotencyConflictError(
      400,
      "Idempotency-Key may only contain letters, digits, and the characters . : _ -",
    );
  }
  return value;
}

export type IdempotentOutcome<T> = {
  result: T;
  /** True when the stored response was replayed instead of `fn` running. */
  replayed: boolean;
};

type ClaimRow = {
  state: string;
  request_hash: string;
  response: unknown;
  claimed: boolean;
  /** Claim generation; prevents a stale worker from completing/releasing a takeover. */
  created_at: Date | string | null;
};

/**
 * Runs `fn` at most once per (userId, key). See the module doc for the contract.
 *
 * When `key` is null (no header sent) `fn` simply runs — callers that require a
 * key should reject the request before getting here.
 */
export async function withIdempotency<T>(input: {
  userId: string;
  key: string | null;
  endpoint: string;
  body: unknown;
  fn: () => Promise<T>;
}): Promise<IdempotentOutcome<T>> {
  const { userId, key, endpoint, body, fn } = input;
  if (!key) return { result: await fn(), replayed: false };

  await ensurePaymentsSchema();
  const storageKey = `${userId}:${key}`;
  const requestHash = hashRequest(endpoint, body);
  const cacheKey = `idem:${storageKey}`;

  // Fast path: a completed response already cached in Redis. The hash is stored
  // alongside so a mismatched replay is still caught without touching Postgres.
  const cached = await cacheGetJson<{ hash: string; result: T }>(cacheKey);
  if (cached) {
    if (cached.hash !== requestHash) throw reusedWithDifferentBody();
    return { result: cached.result, replayed: true };
  }

  // Best-effort lock: collapses a burst of duplicates before they reach the DB.
  // A null token means "not held by us" — either contended or Redis is down —
  // and we fall through to the durable path either way.
  const lockToken = await acquireLock(cacheKey, LOCK_TTL_MS);
  try {
    const claim = await claimKey({ storageKey, userId, endpoint, requestHash });

    if (!claim.claimed) {
      if (claim.request_hash !== requestHash) throw reusedWithDifferentBody();
      if (claim.state === "completed") {
        const result = claim.response as T;
        await cacheSetJson(cacheKey, { hash: requestHash, result }, IDEMPOTENCY_TTL_SECONDS);
        return { result, replayed: true };
      }
      // Someone else is mid-flight and has not gone stale.
      throw new IdempotencyConflictError(
        409,
        "A request with this Idempotency-Key is already in progress. Retry in a moment.",
      );
    }

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      // Do NOT cache failures: releasing the key lets an honest retry through.
      // A failed checkout must be retryable, and the caller is responsible for
      // making sure a partial attempt left no charge behind.
      await releaseKey(storageKey, claim.created_at).catch(() => undefined);
      throw error;
    }

    const completed = await completeKey(storageKey, result, claim.created_at);
    if (!completed) {
      // A very slow worker can be taken over after the stale-claim window. Its
      // side effect may already have happened, but it must not overwrite the
      // newer worker's durable response or Redis cache.
      const current = await readClaim(storageKey);
      if (current?.request_hash !== requestHash) throw reusedWithDifferentBody();
      if (current?.state === "completed") {
        return { result: current.response as T, replayed: true };
      }
      throw new IdempotencyConflictError(
        409,
        "The idempotency claim changed while the request was running. Retry shortly.",
      );
    }
    await cacheSetJson(cacheKey, { hash: requestHash, result }, IDEMPOTENCY_TTL_SECONDS);
    return { result, replayed: false };
  } finally {
    if (lockToken) await releaseLock(cacheKey, lockToken);
  }
}

function reusedWithDifferentBody(): IdempotencyConflictError {
  return new IdempotencyConflictError(
    422,
    "This Idempotency-Key was already used with different request parameters.",
  );
}

/**
 * Atomically claims the key, or reports who holds it.
 *
 * One statement, so two concurrent requests cannot both believe they claimed it.
 * The DO UPDATE branch fires only for a stale in-flight claim, which is how a
 * crashed request's key is recovered rather than wedged until expiry.
 */
async function claimKey(input: {
  storageKey: string;
  userId: string;
  endpoint: string;
  requestHash: string;
}): Promise<ClaimRow> {
  const inserted = await pool().query<ClaimRow>(
    `INSERT INTO payments.idempotency_keys (key, user_id, endpoint, request_hash, state, expires_at)
     VALUES ($1, $2, $3, $4, 'in_flight', NOW() + make_interval(secs => $6))
     ON CONFLICT (key) DO UPDATE
       SET created_at   = NOW(),
           expires_at   = NOW() + make_interval(secs => $6),
           request_hash = EXCLUDED.request_hash
     WHERE payments.idempotency_keys.state = 'in_flight'
       AND payments.idempotency_keys.created_at < NOW() - make_interval(secs => $5)
       -- A stale request may be recovered only for the same canonical body.
       -- Reusing the key for a different purchase remains a 422, even after
       -- the original claimant has gone stale.
       AND payments.idempotency_keys.request_hash = EXCLUDED.request_hash
     RETURNING state, request_hash, response, created_at::text AS created_at, TRUE AS claimed`,
    [
      input.storageKey,
      input.userId,
      input.endpoint,
      input.requestHash,
      IN_FLIGHT_TAKEOVER_SECONDS,
      IDEMPOTENCY_TTL_SECONDS,
    ],
  );
  if (inserted.rows[0]) return inserted.rows[0];

  // The conflict target existed and the takeover predicate did not match, so
  // somebody else owns it — read their row to decide replay vs 409 vs 422.
  const existing = await pool().query<ClaimRow>(
    `SELECT state, request_hash, response, created_at::text AS created_at, FALSE AS claimed
       FROM payments.idempotency_keys WHERE key = $1`,
    [input.storageKey],
  );
  if (existing.rows[0]) return existing.rows[0];

  // Vanished between the two statements (expiry sweep). Do not claim with a
  // NULL generation: an interleaving insert could otherwise be completed or
  // deleted by this worker. Let the caller retry safely instead.
  return {
    state: "in_flight",
    request_hash: input.requestHash,
    response: null,
    claimed: false,
    created_at: null,
  };
}

async function readClaim(storageKey: string): Promise<ClaimRow | null> {
  const result = await pool().query<ClaimRow>(
    `SELECT state, request_hash, response, created_at::text AS created_at, FALSE AS claimed
       FROM payments.idempotency_keys WHERE key = $1`,
    [storageKey],
  );
  return result.rows[0] ?? null;
}

async function completeKey(
  storageKey: string,
  result: unknown,
  claimCreatedAt: Date | string | null,
): Promise<boolean> {
  const updateResult = await pool().query(
    `UPDATE payments.idempotency_keys
        SET state = 'completed', response = $2::jsonb, status_code = 200
      WHERE key = $1 AND state = 'in_flight'
        AND ($3::timestamptz IS NULL OR created_at = $3::timestamptz)`,
    [storageKey, JSON.stringify(result ?? null), claimCreatedAt],
  );
  return (updateResult.rowCount ?? 0) > 0;
}

async function releaseKey(storageKey: string, claimCreatedAt: Date | string | null): Promise<void> {
  await pool().query(
    `DELETE FROM payments.idempotency_keys
      WHERE key = $1 AND state = 'in_flight'
        AND ($2::timestamptz IS NULL OR created_at = $2::timestamptz)`,
    [storageKey, claimCreatedAt],
  );
}

/** Expiry sweep for the drain (Phase 9). Returns how many rows were removed. */
export async function purgeExpiredIdempotencyKeys(limit = 1000): Promise<number> {
  await ensurePaymentsSchema();
  const res = await pool().query(
    `DELETE FROM payments.idempotency_keys
      WHERE key IN (
        SELECT key FROM payments.idempotency_keys WHERE expires_at < NOW() LIMIT $1
      )`,
    [Math.min(Math.max(limit, 1), 10_000)],
  );
  return res.rowCount ?? 0;
}
