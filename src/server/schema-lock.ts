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
 * Transaction-scoped variant is preferred (released by COMMIT/ROLLBACK);
 * `ensureUserSchema` runs without an explicit transaction and uses the
 * session-scoped pair instead.
 */

/** Shared lock id. Every runtime schema-ensure MUST use this one value. */
export const SCHEMA_DDL_LOCK_ID = 4242424200;

/** Take the shared DDL lock for the current transaction. */
export const SCHEMA_DDL_LOCK_SQL = "SELECT pg_advisory_xact_lock($1)";

/** Session-scoped acquire/release, for ensures that run outside a transaction. */
export const SCHEMA_DDL_SESSION_LOCK_SQL = "SELECT pg_advisory_lock($1)";
export const SCHEMA_DDL_SESSION_UNLOCK_SQL = "SELECT pg_advisory_unlock($1)";
