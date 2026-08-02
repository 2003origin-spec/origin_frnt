/**
 * Online completion of the 20260802 CBT attempt-resilience migration.
 *
 * The build-time migration (src/db/migrations/20260802_cbt_attempt_resilience.sql)
 * is catalog-only by design: ADD COLUMN with constant defaults, plus CHECK
 * constraints added NOT VALID. That keeps the Vercel `prebuild` step O(1) so a
 * deploy never holds a long write transaction against Neon.
 *
 * This script does the part that touches existing rows, and does it gently:
 *   1. CREATE INDEX CONCURRENTLY for the two new partial indexes (no write lock);
 *   2. backfill `finalize_reason` for historical rows in bounded chunks with a
 *      pause between them, so replica lag / CPU stay flat;
 *   3. VALIDATE the constraints once nothing is left (SHARE UPDATE EXCLUSIVE —
 *      concurrent reads and writes keep working).
 *
 * It is idempotent and resumable: re-running after an interruption picks up
 * exactly where it stopped. In production it normally does not need to be run
 * by hand at all — the CBT drain cron calls the same logic
 * (advanceCbtResilienceBackfill) with a small per-tick budget until it
 * converges. This script exists for an immediate, observable run.
 *
 * Usage:
 *   npm run db:backfill:cbt-resilience
 *   node --env-file=../.env scripts/backfill-cbt-attempt-resilience.mjs --chunk=1000 --sleep=100
 */

import pg from "pg";

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
);

const CHUNK = Math.min(Math.max(Number(args.get("chunk")) || 500, 50), 5_000);
const SLEEP_MS = Math.min(Math.max(Number(args.get("sleep")) || 50, 0), 5_000);
const DRY_RUN = args.get("dry-run") === "true";

const CONNECTION_STRING = process.env.USER_DATABASE_URL;

function log(message) {
  console.log(`[cbt-backfill] ${message}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const INDEXES = [
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

async function ensureIndexes(pool) {
  for (const index of INDEXES) {
    const existing = await pool.query(
      `SELECT i.indisvalid
         FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = $1`,
      [index.name],
    );
    const row = existing.rows[0];
    if (row?.indisvalid === true) {
      log(`index ${index.name} already valid`);
      continue;
    }
    if (row && row.indisvalid === false) {
      // A previous CONCURRENTLY build failed; the leftover invalid index would
      // make IF NOT EXISTS a permanent no-op.
      log(`dropping invalid index ${index.name}`);
      if (!DRY_RUN) await pool.query(`DROP INDEX CONCURRENTLY IF EXISTS cbt.${index.name}`);
    }
    log(`building ${index.name} concurrently…`);
    if (!DRY_RUN) await pool.query(index.sql);
  }
}

async function countRemaining(pool) {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM cbt.room_participants
      WHERE finished_at IS NOT NULL AND finalize_reason IS NULL`,
  );
  return Number(res.rows[0]?.n ?? 0);
}

async function backfill(pool) {
  let total = 0;
  for (;;) {
    const remaining = await countRemaining(pool);
    if (remaining === 0) break;
    if (DRY_RUN) {
      log(`dry run: ${remaining} row(s) would be backfilled in chunks of ${CHUNK}`);
      break;
    }
    const res = await pool.query(
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
      [CHUNK],
    );
    const n = res.rowCount ?? 0;
    if (n === 0) break;
    total += n;
    log(`backfilled ${total} row(s), ~${Math.max(0, remaining - n)} to go`);
    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }
  return total;
}

async function validateConstraints(pool) {
  const pending = await pool.query(
    `SELECT conname, conrelid::regclass AS tbl
       FROM pg_constraint
      WHERE conname IN ('cbt_participants_finalize_reason_check', 'cbt_rooms_rejoin_policy_check')
        AND NOT convalidated`,
  );
  for (const row of pending.rows) {
    log(`validating ${row.conname}…`);
    if (!DRY_RUN) await pool.query(`ALTER TABLE ${row.tbl} VALIDATE CONSTRAINT ${row.conname}`);
  }
  if (pending.rows.length === 0) log("constraints already validated");
}

async function main() {
  if (!CONNECTION_STRING) {
    log("USER_DATABASE_URL is not set — nothing to do.");
    return;
  }
  const pool = new pg.Pool({
    connectionString: CONNECTION_STRING,
    ssl: /localhost|127\.0\.0\.1/.test(CONNECTION_STRING) ? false : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await ensureIndexes(pool);
    const updated = await backfill(pool);
    await validateConstraints(pool);
    log(`done — ${updated} historical row(s) backfilled.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[cbt-backfill] failed:", error);
  process.exit(1);
});
