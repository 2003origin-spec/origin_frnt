/**
 * Contest schema drift: every table the runtime ensure (contest-schema.ts)
 * creates must also be created by a file in src/db/migrations, so a fresh or
 * DR-restored database built from the migrations folder has the whole contest
 * schema. The two tables that used to exist only in the runtime ensure
 * (question_bookmarks, admin_import_workspaces) are pinned verbatim.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const migrationsDir = join(root, "src/db/migrations");
const schemaSource = readFileSync(join(root, "src/server/contest/contest-schema.ts"), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

const MIGRATION_ID = "20261022_contest_bookmarks_import_workspaces";
const migration = readFileSync(join(migrationsDir, `${MIGRATION_ID}.sql`), "utf8");
const rollback = readFileSync(join(migrationsDir, `${MIGRATION_ID}.rollback.sql`), "utf8");

const forwardMigrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !f.endsWith(".rollback.sql"))
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

/** The CREATE TABLE block (through its closing `);`) for one table in the runtime DDL. */
function runtimeCreateTable(table: string): string {
  const start = schemaSource.indexOf(`CREATE TABLE IF NOT EXISTS contest.${table} (`);
  assert.ok(start >= 0, `contest-schema.ts no longer creates contest.${table}`);
  const end = schemaSource.indexOf("\n);", start);
  return schemaSource.slice(start, end + 3);
}

test("every contest.* table in the runtime ensure is created by some migration file", () => {
  const tables = [...schemaSource.matchAll(/CREATE TABLE IF NOT EXISTS contest\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tables.length > 5, "expected to find the contest tables in contest-schema.ts");
  const missing = tables.filter(
    (t) => !new RegExp(`CREATE TABLE (IF NOT EXISTS )?contest\\.${t}\\b`).test(forwardMigrations),
  );
  assert.deepEqual(missing, [], `contest tables with no migration: ${missing.join(", ")}`);
});

test("question_bookmarks and admin_import_workspaces are copied verbatim (tables + index)", () => {
  for (const table of ["admin_import_workspaces", "question_bookmarks"]) {
    const block = runtimeCreateTable(table);
    assert.ok(migration.includes(block), `${MIGRATION_ID}.sql drifted from contest-schema.ts for ${table}`);
  }
  const index = schemaSource.match(/CREATE INDEX IF NOT EXISTS idx_contest_bookmarks_user [^\n]*/);
  assert.ok(index, "runtime index idx_contest_bookmarks_user not found");
  assert.ok(migration.includes(index[0]), "bookmark index drifted");
  assert.doesNotMatch(migration, /\bDROP\b/, "forward migration never drops anything");
});

test("the rollback drops both tables", () => {
  assert.match(rollback, /DROP TABLE IF EXISTS contest\.question_bookmarks;/);
  assert.match(rollback, /DROP TABLE IF EXISTS contest\.admin_import_workspaces;/);
});

test("the migration is registered in the build-time runner after contest_core", () => {
  const core = runner.indexOf('"20260819_contest_core.sql"');
  const ours = runner.indexOf(`"${MIGRATION_ID}.sql"`);
  assert.ok(core >= 0 && ours > core, "register the migration in scripts/run-migrations.mjs after contest_core");
});
