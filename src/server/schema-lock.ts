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
