/**
 * Schema-ensure must use transaction-scoped advisory locks only.
 * Session `pg_advisory_lock` sticks on Neon PgBouncer transaction-mode pooling.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dbUsers = readFileSync(new URL("../../src/server/db-users.ts", import.meta.url), "utf8");
const schemaLock = readFileSync(new URL("../../src/server/schema-lock.ts", import.meta.url), "utf8");

test("ensureUserSchema takes the shared DDL lock inside a transaction", () => {
  assert.match(dbUsers, /await client\.query\("BEGIN"\)/);
  assert.match(dbUsers, /SCHEMA_DDL_LOCK_SQL/);
  assert.match(dbUsers, /await client\.query\("COMMIT"\)/);
  assert.match(dbUsers, /ROLLBACK/);
  assert.doesNotMatch(dbUsers, /pg_advisory_lock/);
  assert.doesNotMatch(dbUsers, /pg_advisory_unlock/);
});

test("schema lock helper is transaction-scoped and has no session lock pair", () => {
  assert.match(schemaLock, /SCHEMA_DDL_LOCK_SQL = "SELECT pg_advisory_xact_lock\(\$1\)"/);
  assert.doesNotMatch(schemaLock, /SCHEMA_DDL_SESSION_LOCK_SQL/);
  assert.doesNotMatch(schemaLock, /SCHEMA_DDL_SESSION_UNLOCK_SQL/);
});
