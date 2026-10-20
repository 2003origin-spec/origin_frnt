/**
 * The runtime ensure (src/server/notes/notes-schema.ts) and the migration file
 * must stay identical, statement for statement — prod may get either one.
 * Read as text so this stays a pure unit test (no DB, no server-only imports).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const runtime = readFileSync(join(root, "src/server/notes/notes-schema.ts"), "utf8");
const migration = readFileSync(join(root, "src/db/migrations/20261018_notes_core.sql"), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations/20261018_notes_core.rollback.sql"), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

function runtimeStatements(): string[] {
  const block = runtime.slice(runtime.indexOf("NOTES_SCHEMA_DDL"), runtime.indexOf("];", runtime.indexOf("NOTES_SCHEMA_DDL")));
  return [...block.matchAll(/`([\s\S]*?)`/gu)].map((m) => m[1]);
}

test("every runtime DDL statement appears verbatim in the migration", () => {
  const statements = runtimeStatements();
  assert.ok(statements.length >= 15, `expected the full DDL list, got ${statements.length}`);
  for (const statement of statements) {
    assert.ok(migration.includes(`${statement};`), `missing from the migration:\n${statement.slice(0, 120)}`);
  }
});

test("the DDL is idempotent and additive", () => {
  for (const statement of runtimeStatements()) {
    if (/^CREATE (TABLE|SCHEMA)/u.test(statement)) assert.match(statement, /IF NOT EXISTS/u);
    if (/^CREATE (UNIQUE )?INDEX/u.test(statement)) assert.match(statement, /IF NOT EXISTS/u);
    if (/^INSERT/u.test(statement)) assert.match(statement, /ON CONFLICT/u);
    assert.doesNotMatch(statement, /\bDROP\b/u);
  }
});

test("the migration records itself, and the rollback undoes that", () => {
  assert.match(migration, /INSERT INTO app\.migrations \(id, name\)\s+VALUES \('20261018_notes_core'/u);
  assert.match(rollback, /DROP SCHEMA IF EXISTS notes CASCADE/u);
  assert.match(rollback, /DELETE FROM app\.migrations WHERE id = '20261018_notes_core'/u);
});

test("like Origin NOW, the migration is not in the prebuild allowlist", () => {
  assert.doesNotMatch(runner, /notes_core/u);
});
