/**
 * The runtime ensure (src/server/messaging/schema.ts) and the migration file
 * must stay identical, statement for statement — prod may get either one.
 * Read as text so this stays a pure unit test (no DB, no server-only imports).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const runtime = readFileSync(join(root, "src/server/messaging/schema.ts"), "utf8");
const migration = readFileSync(join(root, "src/db/migrations/20261101_student_messaging.sql"), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations/20261101_student_messaging.rollback.sql"), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

function runtimeStatements(): string[] {
  const start = runtime.indexOf("MESSAGING_SCHEMA_DDL: readonly string[]");
  const block = runtime.slice(start, runtime.indexOf("];", start));
  return [...block.matchAll(/`([\s\S]*?)`/gu)].map((m) => m[1]);
}

test("every runtime DDL statement appears verbatim in the migration", () => {
  const statements = runtimeStatements();
  assert.ok(statements.length >= 14, `expected the full DDL list, got ${statements.length}`);
  for (const statement of statements) {
    assert.ok(migration.includes(`${statement};`), `missing from the migration:\n${statement.slice(0, 120)}`);
  }
});

test("the DDL is idempotent and additive", () => {
  for (const statement of runtimeStatements()) {
    if (/^CREATE (TABLE|SCHEMA)/u.test(statement)) assert.match(statement, /IF NOT EXISTS/u);
    if (/^CREATE (UNIQUE )?INDEX/u.test(statement)) assert.match(statement, /IF NOT EXISTS/u);
    assert.doesNotMatch(statement, /\bDROP\b/u);
  }
});

test("the 500-character limit and the report reasons match the rules module", () => {
  assert.match(migration, /char_length\(body\) BETWEEN 1 AND 500/u);
  assert.match(migration, /reason IN \('spam','abuse','inappropriate','other'\)/u);
});

test("the migration records itself, and the rollback undoes that", () => {
  assert.match(migration, /INSERT INTO app\.migrations \(id, name\)\s+VALUES \('20261101_student_messaging'/u);
  assert.match(rollback, /DROP SCHEMA IF EXISTS messaging CASCADE/u);
  assert.match(rollback, /DELETE FROM app\.migrations WHERE id = '20261101_student_messaging'/u);
});

test("like Notes and Origin NOW, the migration is not in the prebuild allowlist", () => {
  assert.doesNotMatch(runner, /student_messaging/u);
});
