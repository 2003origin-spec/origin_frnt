/**
 * Online (post-deploy) completion of the 20260802 attempt-resilience migration.
 *
 * The build-time migration only does catalog work — ADD COLUMN with constant
 * defaults and NOT VALID CHECK constraints — so a Vercel deploy never holds a
 * long write transaction against Neon. Everything that touches existing rows
 * happens here instead, in small resumable chunks:
 *
 *   1. build the two new partial indexes CONCURRENTLY (no write lock);
 *   2. backfill `finalize_reason` for historical rows in batches;
 *   3. VALIDATE the NOT VALID constraints once no NULL-reason rows remain
 *      (SHARE UPDATE EXCLUSIVE — does not block reads or writes).
 *
 * Every step is idempotent and independently skippable, so this is safe to call
 * on a schedule. The CBT drain cron ticks it with a small time budget until it
 * converges; `npm run db:backfill:cbt-resilience` runs it to completion by hand.
 *
 * Correctness during the backfill window: readers never require the new column.
 * `finalizeStatusLabel` / `finalizeRemark` fall back to the legacy
 * `auto_submitted` boolean whenever `finalize_reason` is still NULL, so an
 * export taken mid-backfill reads exactly as it did before the deploy.
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

export type CbtBackfillProgress = {
  /** Historical rows still missing a finalize_reason. */
  remaining: number;
  /** Rows updated by this invocation. */
  updated: number;
  indexesReady: boolean;
  constraintsValidated: boolean;
  /** True once nothing is left to do — callers can stop scheduling work. */
  done: boolean;
};

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_BUDGET_MS = 2_000;

/** Set once the backfill has converged, so cron ticks stop re-querying. */
declare global {
  var __originCbtBackfillDone: boolean | undefined;
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const NEW_INDEXES: { name: string; sql: string }[] = [
  {
    name: "idx_cbt_participants_room_unfinished",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cbt_participants_room_unfinished
            ON cbt.room_participants (room_id) WHERE finished_at IS NULL`,
  },
  {
    name: "idx_cbt_rooms_live_deadline",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cbt_rooms_live_deadline
            ON cbt.rooms (started_at) WHERE status = 'in_test'`,
  },
];

/**
 * Builds the new partial indexes without taking a write lock.
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so these are
 * issued as standalone statements on a pooled connection (autocommit). A failed
 * concurrent build leaves an INVALID index behind, which would otherwise make
 * `IF NOT EXISTS` a permanent no-op — so invalid ones are dropped first and
 * rebuilt on the next tick.
 */
async function ensureIndexes(): Promise<boolean> {
  let allReady = true;
  for (const index of NEW_INDEXES) {
    try {
      const existing = await pool().query(
        `SELECT i.indisvalid
           FROM pg_class c
           JOIN pg_index i ON i.indexrelid = c.oid
          WHERE c.relname = $1`,
        [index.name],
      );
      const row = existing.rows[0];
      if (row && row.indisvalid === false) {
        await pool().query(`DROP INDEX CONCURRENTLY IF EXISTS cbt.${index.name}`);
      } else if (row) {
        continue; // already built and valid
      }
      await pool().query(index.sql);
    } catch (error) {
      // A concurrent build can lose a race with another instance (or be
      // cancelled by a lock timeout). Never fail the caller — retry next tick.
      console.warn(`[cbt-backfill] index ${index.name} not ready yet`, error);
      allReady = false;
    }
  }
  return allReady;
}

/** Rows finished before the deploy, which therefore carry no reason yet. */
async function countRemaining(): Promise<number> {
  const res = await pool().query(
    `SELECT COUNT(*)::int AS n
       FROM cbt.room_participants
      WHERE finished_at IS NOT NULL AND finalize_reason IS NULL`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

/**
 * Backfills one batch. The historical distinction available to us is the legacy
 * `auto_submitted` boolean, which is exactly what the export used to read — so
 * the mapping is lossless for old rows.
 */
async function backfillChunk(chunkSize: number): Promise<number> {
  const res = await pool().query(
    `UPDATE cbt.room_participants p
        SET finalize_reason = CASE WHEN p.auto_submitted THEN 'timer' ELSE 'manual' END
       FROM (
         SELECT id FROM cbt.room_participants
          WHERE finished_at IS NOT NULL AND finalize_reason IS NULL
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       ) AS batch
      WHERE p.id = batch.id`,
    [chunkSize],
  );
  return res.rowCount ?? 0;
}

/** Promotes the NOT VALID constraints once every row satisfies them. */
async function validateConstraints(): Promise<boolean> {
  const pending = await pool().query(
    `SELECT conname, conrelid::regclass AS tbl
       FROM pg_constraint
      WHERE conname IN ('cbt_participants_finalize_reason_check', 'cbt_rooms_rejoin_policy_check')
        AND NOT convalidated`,
  );
  if (pending.rows.length === 0) return true;

  for (const row of pending.rows) {
    try {
      await pool().query(`ALTER TABLE ${String(row.tbl)} VALIDATE CONSTRAINT ${String(row.conname)}`);
    } catch (error) {
      console.warn(`[cbt-backfill] validate ${String(row.conname)} deferred`, error);
      return false;
    }
  }
  return true;
}

/**
 * Advances the backfill by at most `budgetMs` of work. Safe to call from a cron
 * tick, a request path, or a script; concurrent callers are serialised by
 * FOR UPDATE SKIP LOCKED rather than blocking each other.
 */
export async function advanceCbtResilienceBackfill(
  opts: { chunkSize?: number; budgetMs?: number; runToCompletion?: boolean } = {},
): Promise<CbtBackfillProgress> {
  const idle: CbtBackfillProgress = {
    remaining: 0,
    updated: 0,
    indexesReady: true,
    constraintsValidated: true,
    done: true,
  };
  if (!isUserPostgresConfigured()) return idle;
  if (globalThis.__originCbtBackfillDone && !opts.runToCompletion) return idle;

  const chunkSize = Math.min(Math.max(opts.chunkSize ?? DEFAULT_CHUNK_SIZE, 50), 5_000);
  const budgetMs = Math.max(opts.budgetMs ?? DEFAULT_BUDGET_MS, 250);
  const deadline = Date.now() + budgetMs;

  const indexesReady = await ensureIndexes();

  let updated = 0;
  let remaining = await countRemaining();
  while (remaining > 0 && (opts.runToCompletion || Date.now() < deadline)) {
    const n = await backfillChunk(chunkSize);
    if (n === 0) break; // nothing claimable right now
    updated += n;
    remaining -= n;
  }
  remaining = await countRemaining();

  const constraintsValidated = remaining === 0 ? await validateConstraints() : false;
  const done = indexesReady && constraintsValidated && remaining === 0;
  if (done) globalThis.__originCbtBackfillDone = true;

  return { remaining, updated, indexesReady, constraintsValidated, done };
}
