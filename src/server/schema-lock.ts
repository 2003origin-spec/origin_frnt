/**
 * One advisory lock for ALL runtime schema-ensure DDL.
 *
 * Why a single shared id rather than one per module:
 *
 * `CREATE TABLE IF NOT EXISTS` is not atomic against a concurrent creator, so
 * each ensure module was given its own advisory lock. That fixed the duplicate
 * `pg_type` collision but introduced a worse failure — a lock-ordering
 * DEADLOCK. The modules touch overlapping relations (nearly all of them carry a
 * foreign key to `origin_users`), so two processes running two DIFFERENT
 * ensures take relation locks in opposite orders:
 *
 *   process A  ensureUserSchema        holds origin_users, wants subject_grants
 *   process B  ensureSubjectGrantsSchema  holds subject_grants, wants origin_users
 *
 * Postgres kills one with `40P01 deadlock detected`. Distinct advisory locks
 * cannot prevent that, because the two processes never contend on the same
 * advisory lock at all.
 *
 * A single lock makes all schema DDL mutually exclusive, which removes the
 * ordering problem by construction. The cost is nil in practice: every ensure
 * is memoised per process and only does real work against an un-migrated
 * database, so this serialises a cold start, not the request path.
 *
 * Always transaction-scoped (`pg_advisory_xact_lock` inside BEGIN/COMMIT).
 * Session-scoped `pg_advisory_lock` is unsafe on Neon PgBouncer transaction
 * mode: the lock can stick on a pooled connection after the client is released.
 */

import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

/** Shared lock id. Every runtime schema-ensure MUST use this one value. */
export const SCHEMA_DDL_LOCK_ID = 4242424200;

/** Take the shared DDL lock for the current transaction. */
export const SCHEMA_DDL_LOCK_SQL = "SELECT pg_advisory_xact_lock($1)";

/**
 * Take the shared DDL lock inside a transaction the caller already opened
 * (`BEGIN` must have run on `client`). Outside a transaction the xact lock is
 * released at the end of this very statement, so it would protect nothing.
 */
export async function lockSchemaDdl(client: Pick<PoolClient, "query">): Promise<void> {
  await client.query(SCHEMA_DDL_LOCK_SQL, [SCHEMA_DDL_LOCK_ID]);
}

/** Only a checked-out client carries `release`; a pg.Pool does not. */
function isCheckedOutClient(target: Pool | PoolClient): target is PoolClient {
  return typeof (target as { release?: unknown }).release === "function";
}

/**
 * Run `fn` inside `BEGIN … COMMIT` holding the shared DDL lock.
 *
 * - Given a pool, a client is checked out, used and released.
 * - Given a client, it must NOT already be inside a transaction: this opens
 *   and closes one on it. Inside an existing transaction use `lockSchemaDdl`.
 *
 * Never await another module's `ensure*()` from inside `fn`: that ensure takes
 * this lock on a different connection and would wait forever on this one.
 */
export async function withSchemaLock<T>(
  target: Pool | PoolClient,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const borrowed = !isCheckedOutClient(target);
  const client = isCheckedOutClient(target) ? target : await target.connect();
  try {
    await client.query("BEGIN");
    try {
      await lockSchemaDdl(client);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    if (borrowed) client.release();
  }
}

/**
 * Version marker for a runtime ensure, so an up-to-date database skips its DDL.
 *
 * Re-running `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is not free even when the
 * column exists: Postgres takes ACCESS EXCLUSIVE on the table before it checks,
 * and holds it to COMMIT, so every cold instance briefly blocked all reads of
 * that table (and queued behind any long read of it). A module computes its id
 * from its OWN DDL text, checks it with one plain SELECT (no lock), and only
 * when it is missing takes the shared lock, runs the DDL and records the id in
 * the same transaction. Changing the DDL text changes the id, so a new column
 * is always applied; old ids stay behind as history (one row per DDL version).
 * The ids live in `app.migrations` next to the store's migration rows.
 */
export function runtimeDdlVersionId(module: string, ddl: string): string {
  const digest = createHash("sha256").update(ddl).digest("hex").slice(0, 16);
  return `runtime_ddl:${module}:${digest}`;
}

export const RUNTIME_DDL_APPLIED_SQL = "SELECT 1 FROM app.migrations WHERE id = $1 LIMIT 1";

/**
 * True when `versionId` is recorded. Any failure (no `app` schema or
 * `app.migrations` on a fresh database, a dropped connection) answers false,
 * so the caller falls back to the locked DDL path exactly as before.
 */
export async function isRuntimeDdlApplied(target: Pick<Pool, "query">, versionId: string): Promise<boolean> {
  try {
    const result = await target.query(RUNTIME_DDL_APPLIED_SQL, [versionId]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * isRuntimeDdlApplied for a client INSIDE an open transaction (the re-check
 * after taking the lock). A failed SELECT would abort that transaction, so the
 * table's existence is checked first instead of catching the error.
 */
export async function isRuntimeDdlAppliedInTransaction(
  client: Pick<PoolClient, "query">,
  versionId: string,
): Promise<boolean> {
  const table = await client.query("SELECT to_regclass('app.migrations') IS NOT NULL AS present");
  if (table.rows[0]?.present !== true) return false;
  const result = await client.query(RUNTIME_DDL_APPLIED_SQL, [versionId]);
  return result.rows.length > 0;
}

/** Same definition as ensureAppStoreSchema's, so either may create it first. */
const RUNTIME_DDL_RECORD_TABLE_SQL = `
  CREATE SCHEMA IF NOT EXISTS app;

  CREATE TABLE IF NOT EXISTS app.migrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

/**
 * Record `versionId` inside the caller's DDL transaction (after its DDL ran,
 * holding the shared lock), so the marker commits or rolls back with the DDL.
 */
export async function recordRuntimeDdlApplied(
  client: Pick<PoolClient, "query">,
  versionId: string,
  name: string,
): Promise<void> {
  await client.query(RUNTIME_DDL_RECORD_TABLE_SQL);
  await client.query(
    "INSERT INTO app.migrations (id, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING",
    [versionId, name],
  );
}
