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

/** Shared lock id. Every runtime schema-ensure MUST use this one value. */
export const SCHEMA_DDL_LOCK_ID = 4242424200;

/** Take the shared DDL lock for the current transaction. */
export const SCHEMA_DDL_LOCK_SQL = "SELECT pg_advisory_xact_lock($1)";
