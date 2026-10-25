/**
 * Durable "already rewarded" claims for prestige points.
 *
 * Why: `awardPoints` used to be called unconditionally on every test / DPP
 * submit (bug G6) and on every book save / pomodoro completion (bug N4), so the
 * global leaderboard — which decides a real prize — was farmable by
 * resubmitting the same test or toggling a save. The in-memory point log
 * cannot guard this across instances (the store is a whole-row upsert from
 * memory), so the guard is a claim row in `app.point_awards` keyed on
 * `(user_id, award_key)`: the first `INSERT … ON CONFLICT DO NOTHING RETURNING`
 * wins, every later one returns no row and awards nothing.
 *
 * Award-key shapes (see the 20261022_point_awards migration):
 *   `test:<testId>`                first completed attempt of a test
 *   `dpp:<dppId>`                  first completed attempt of a DPP
 *   `<activityType>:<referenceId>` activity awards (`study_corner:<bookId>`,
 *                                  `pomodoro:<sessionId>`, …)
 *
 * No Postgres ⇒ no durable claim ⇒ no points. That is deliberate: a path that
 * cannot prove "first time" must not pay out.
 */

import type { Pool } from "pg";

import { awardPoints } from "@/server/gamification";
import { trackPointAwardClaim } from "@/server/point-award-scope";
import { SCHEMA_DDL_LOCK_ID, SCHEMA_DDL_LOCK_SQL } from "@/server/schema-lock";
import type { AppStore, StoredPointLog } from "@/server/store";
import { getUserPostgresPool } from "@/server/user-postgres";

/** The subset of `pg.Pool` this module uses — tests pass a stub. */
export type PointAwardPool = Pick<Pool, "query" | "connect">;

export type PointAwardKind = "test" | "dpp";

export interface PointAwardClaim {
  userId: string;
  awardKey: string;
  points: number;
  referenceId: string | null;
}

/** Mirrors src/db/migrations/20261022_point_awards.sql. Idempotent. */
export const POINT_AWARDS_DDL = `
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.point_awards (
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  award_key TEXT NOT NULL,
  points NUMERIC NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, award_key)
);
`;

const CLAIM_SQL = `
INSERT INTO app.point_awards (user_id, award_key, points, reference_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, award_key) DO NOTHING
RETURNING user_id, award_key, points, reference_id
`;

/** `test:<id>` / `dpp:<id>` — one award per assessment per student. */
export function assessmentAwardKey(kind: PointAwardKind, assessmentId: string): string {
  return `${kind}:${assessmentId}`;
}

/** `<activityType>:<referenceId>` — one award per activity reference. */
export function activityAwardKey(activityType: string, referenceId: string): string {
  return `${activityType}:${referenceId}`;
}

// Memoised per pool so a stubbed pool in tests and the real pool in prod each
// run the DDL once per process (same pattern as the other ensure modules).
const ensured = new WeakMap<PointAwardPool, Promise<void>>();

/**
 * Runtime-ensure for `app.point_awards`. Takes the shared DDL advisory lock
 * inside a transaction (see src/server/schema-lock.ts for why one shared id).
 */
export async function ensurePointAwardsSchema(pool: PointAwardPool): Promise<void> {
  let pending = ensured.get(pool);
  if (!pending) {
    pending = (async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(SCHEMA_DDL_LOCK_SQL, [SCHEMA_DDL_LOCK_ID]);
        await client.query(POINT_AWARDS_DDL);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })();
    ensured.set(pool, pending);
    pending.catch(() => {
      // Let the next call retry instead of caching a transient failure.
      if (ensured.get(pool) === pending) ensured.delete(pool);
    });
  }
  await pending;
}

/**
 * Claim `(userId, awardKey)`. Returns the claim row when this call is the
 * first to claim it, `null` when it was already claimed, when no Postgres is
 * configured, or when the claim could not be made durable (DB error — logged;
 * the safe direction is "no points", never a duplicate award).
 */
export async function claimPointAward(
  userId: string,
  awardKey: string,
  points: number,
  referenceId: string | null,
  pool: PointAwardPool | null = getUserPostgresPool(),
): Promise<PointAwardClaim | null> {
  if (!pool) return null;
  try {
    await ensurePointAwardsSchema(pool);
    const result = await pool.query(CLAIM_SQL, [userId, awardKey, points, referenceId]);
    const row = result.rows[0] as
      | { user_id: string; award_key: string; points: string | number; reference_id: string | null }
      | undefined;
    if (!row) return null;
    // Released again if the store write this award belongs to fails (L2).
    trackPointAwardClaim({ userId: row.user_id, awardKey: row.award_key, referenceId: row.reference_id ?? null });
    return {
      userId: row.user_id,
      awardKey: row.award_key,
      points: Number(row.points),
      referenceId: row.reference_id ?? null,
    };
  } catch (error) {
    console.warn(`[point-awards] claim failed for ${awardKey}; awarding nothing`, error);
    return null;
  }
}

/**
 * `awardPoints` with a durable once-per-reference guard: the claim key is
 * `<activityType>:<referenceId>`, so e.g. the first save of a book is the only
 * rewarded one, no matter how many times it is toggled or on how many
 * instances. Returns the point log, or `null` when nothing was awarded.
 */
export async function awardPointsOnce(
  store: AppStore,
  userId: string,
  points: number,
  activityType: string,
  description: string,
  referenceId: string,
  pool: PointAwardPool | null = getUserPostgresPool(),
): Promise<StoredPointLog | null> {
  if (points <= 0) return null;
  const claim = await claimPointAward(userId, activityAwardKey(activityType, referenceId), points, referenceId, pool);
  if (!claim) return null;
  return awardPoints(store, userId, points, activityType, description, referenceId);
}
