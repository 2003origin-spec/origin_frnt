/**
 * Cold-start DDL (cold-start-runtime-ddl, cold-instance-app-store-ddl):
 * ensureUserSchema / ensureAppStoreSchema skip their DDL on an up-to-date
 * database with one lock-free SELECT of a version id computed from the DDL
 * text, and only take the shared lock and run the DDL when that id is missing
 * (a fresh dev database, or the first cold start after the DDL changed).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ensureUserSchema, USER_SCHEMA_DDL_VERSION } from "../../src/server/db-users";
import { appStoreSchemaDdl, appStoreSchemaVersionId, collectionTables, ensureAppStoreSchema } from "../../src/server/store-postgres";
import {
  isRuntimeDdlApplied,
  isRuntimeDdlAppliedInTransaction,
  RUNTIME_DDL_APPLIED_SQL,
  runtimeDdlVersionId,
  SCHEMA_DDL_LOCK_SQL,
} from "../../src/server/schema-lock";
import { installFakeUserPool } from "./_scoped-store-fakes";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

function resetEnsureFlags() {
  g.__originUserSchemaEnsured = false;
  g.__originUserSchemaPromise = undefined;
  g.__originAppStoreSchemaEnsured = false;
  g.__originAppStoreSchemaPromise = undefined;
}

/** A fake pool where `applied` lists the recorded version ids. */
function setup(applied: Set<string>, options: { appearsAfterLock?: string } = {}) {
  const values: Array<{ sql: string; values?: unknown[] }> = [];
  let lockTaken = false;
  const sql = installFakeUserPool({
    onQuery: (statement, params) => {
      values.push({ sql: statement, values: params });
      if (statement.startsWith(SCHEMA_DDL_LOCK_SQL)) lockTaken = true;
      if (statement.startsWith("INSERT INTO app.migrations") && typeof params?.[0] === "string") applied.add(params[0]);
    },
    rowsFor: (statement, params) => {
      if (statement.startsWith("SELECT to_regclass('app.migrations')")) return [{ present: true }];
      if (statement === RUNTIME_DDL_APPLIED_SQL) {
        const id = String(params?.[0]);
        if (options.appearsAfterLock === id && lockTaken) return [{ "?column?": 1 }];
        return applied.has(id) ? [{ "?column?": 1 }] : [];
      }
      return undefined;
    },
  });
  resetEnsureFlags();
  return { sql, values };
}

test("version ids are stable, module-scoped and change with the DDL text", () => {
  assert.equal(runtimeDdlVersionId("m", "CREATE TABLE x ()"), runtimeDdlVersionId("m", "CREATE TABLE x ()"));
  assert.notEqual(runtimeDdlVersionId("m", "CREATE TABLE x ()"), runtimeDdlVersionId("m", "CREATE TABLE x (y int)"));
  assert.notEqual(runtimeDdlVersionId("a", "same"), runtimeDdlVersionId("b", "same"));
  assert.match(USER_SCHEMA_DDL_VERSION, /^runtime_ddl:origin_users:[0-9a-f]{16}$/);
  assert.match(appStoreSchemaVersionId(), /^runtime_ddl:app_store:[0-9a-f]{16}$/);
});

test("the app store DDL covers every collection table, so a new collection changes the version", () => {
  const ddl = appStoreSchemaDdl();
  for (const table of collectionTables()) {
    assert.ok(ddl.includes(`CREATE TABLE IF NOT EXISTS app.${table} (`), `missing table ${table}`);
    assert.ok(ddl.includes(`idx_${table}_user_created`), `missing index for ${table}`);
  }
  assert.ok(ddl.includes("CREATE TABLE IF NOT EXISTS app.tasks"));
  assert.ok(ddl.includes("idx_subject_ranks_user_subject"));
});

test("up-to-date database: both ensures are one SELECT each, no lock, no transaction, no ALTER", async () => {
  const { sql } = setup(new Set([USER_SCHEMA_DDL_VERSION, appStoreSchemaVersionId()]));
  await ensureAppStoreSchema();
  assert.deepEqual(sql, [RUNTIME_DDL_APPLIED_SQL, RUNTIME_DDL_APPLIED_SQL]);
  assert.equal(g.__originUserSchemaEnsured, true);
  assert.equal(g.__originAppStoreSchemaEnsured, true);
});

test("fresh database: takes the lock, runs the DDL and records both versions in the same transaction", async () => {
  const applied = new Set<string>();
  // Fresh: app.migrations does not exist yet, so the in-transaction re-check
  // must not query it (a failed SELECT would abort the DDL transaction).
  const log = installFakeUserPool({
    onQuery: (statement, params) => {
      if (statement.startsWith("INSERT INTO app.migrations") && typeof params?.[0] === "string") applied.add(params[0]);
    },
    rowsFor: (statement) => (statement.startsWith("SELECT to_regclass") ? [{ present: false }] : undefined),
  });
  resetEnsureFlags();
  await ensureAppStoreSchema();
  const userDdl = log.findIndex((s) => s.includes("CREATE TABLE IF NOT EXISTS origin_users"));
  const storeDdl = log.findIndex((s) => s.includes("CREATE TABLE IF NOT EXISTS app.streaks"));
  assert.ok(userDdl > 0 && storeDdl > userDdl, "user DDL, then store DDL");
  assert.equal(log.filter((s) => s.startsWith(SCHEMA_DDL_LOCK_SQL)).length, 2, "lock taken once per ensure");
  assert.equal(log.filter((s) => s === "COMMIT").length, 2);
  assert.ok(applied.has(USER_SCHEMA_DDL_VERSION));
  assert.ok(applied.has(appStoreSchemaVersionId()));
  assert.ok(applied.has("20260504_week2_app_store"), "the original store migration row is still written");
  // Inside each transaction only the to_regclass probe runs, never the
  // version SELECT against the (missing) table.
  let inTransaction = false;
  for (const statement of log) {
    if (statement === "BEGIN") inTransaction = true;
    if (statement === "COMMIT") inTransaction = false;
    if (inTransaction) assert.notEqual(statement, RUNTIME_DDL_APPLIED_SQL);
  }
});

test("another instance applied it while we waited for the lock: COMMIT without DDL", async () => {
  const { sql } = setup(new Set([appStoreSchemaVersionId()]), { appearsAfterLock: USER_SCHEMA_DDL_VERSION });
  await ensureUserSchema();
  assert.equal(sql.some((s) => s.includes("ALTER TABLE")), false);
  assert.equal(sql.some((s) => s.includes("CREATE TABLE IF NOT EXISTS origin_users")), false);
  assert.ok(sql.includes("COMMIT"));
  assert.equal(g.__originUserSchemaEnsured, true);
});

test("a failed DDL transaction rolls back and the next call retries", async () => {
  const applied = new Set<string>();
  let fail = true;
  installFakeUserPool({
    failFor: (statement) => fail && statement.includes("CREATE TABLE IF NOT EXISTS origin_users"),
    onQuery: (statement, params) => {
      if (statement.startsWith("INSERT INTO app.migrations") && typeof params?.[0] === "string") applied.add(params[0]);
    },
  });
  resetEnsureFlags();
  await assert.rejects(ensureUserSchema(), /forced failure/);
  assert.equal(applied.size, 0, "no version recorded for a failed DDL");
  assert.notEqual(g.__originUserSchemaEnsured, true);
  fail = false;
  await ensureUserSchema();
  assert.ok(applied.has(USER_SCHEMA_DDL_VERSION));
});

test("isRuntimeDdlApplied answers false (so the DDL path runs) when the probe fails", async () => {
  const pool = { query: async () => Promise.reject(new Error('relation "app.migrations" does not exist')) };
  assert.equal(await isRuntimeDdlApplied(pool as never, "x"), false);
  const present = { query: async () => ({ rows: [{}] }) };
  assert.equal(await isRuntimeDdlApplied(present as never, "x"), true);

  const calls: string[] = [];
  const noTable = { query: async (text: string) => (calls.push(text), { rows: [{ present: false }] }) };
  assert.equal(await isRuntimeDdlAppliedInTransaction(noTable as never, "x"), false);
  assert.equal(calls.length, 1, "never queries a missing table inside the transaction");
});
