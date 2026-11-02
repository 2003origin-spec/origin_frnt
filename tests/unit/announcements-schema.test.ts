/**
 * The runtime ensure (src/server/announcements/schema.ts) and the migration
 * file must stay identical, statement for statement — prod may get either one.
 * Read as text so this stays a pure unit test (no DB, no server-only imports).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_DEFAULT_LINK, ANNOUNCEMENT_LINK_MAX, ANNOUNCEMENT_TITLE_MAX } from "../../src/lib/announcements";

const root = new URL("../..", import.meta.url).pathname;
const runtime = readFileSync(join(root, "src/server/announcements/schema.ts"), "utf8");
const migration = readFileSync(join(root, "src/db/migrations/20261102_admin_announcements.sql"), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations/20261102_admin_announcements.rollback.sql"), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

function runtimeStatements(): string[] {
  const start = runtime.indexOf("ANNOUNCEMENTS_SCHEMA_DDL: readonly string[]");
  const block = runtime.slice(start, runtime.indexOf("];", start));
  return [...block.matchAll(/`([\s\S]*?)`/gu)].map((m) => m[1]);
}

test("every runtime DDL statement appears verbatim in the migration", () => {
  const statements = runtimeStatements();
  assert.equal(statements.length, 4, `expected the full DDL list, got ${statements.length}`);
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

test("the table's limits match the validation rules", () => {
  assert.match(migration, new RegExp(`char_length\\(title\\) BETWEEN 1 AND ${ANNOUNCEMENT_TITLE_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(body\\) BETWEEN 1 AND ${ANNOUNCEMENT_BODY_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(link\\) BETWEEN 1 AND ${ANNOUNCEMENT_LINK_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`link\\s+TEXT NOT NULL DEFAULT '${ANNOUNCEMENT_DEFAULT_LINK}'`, "u"));
  for (const column of ["id", "title", "body", "link", "audience", "sent_by", "test", "recipients", "push_attempted", "push_delivered", "created_at", "finished_at"]) {
    assert.match(migration, new RegExp(`\\n  ${column}\\s+`, "u"), column);
  }
});

test("the migration records itself with the runtime's id and name, and the rollback undoes that", () => {
  assert.match(runtime, /ANNOUNCEMENTS_MIGRATION_ID = "20261102_admin_announcements"/u);
  const name = /ANNOUNCEMENTS_MIGRATION_NAME = "([^"]+)"/u.exec(runtime)?.[1];
  assert.ok(name);
  assert.ok(migration.includes(`VALUES ('20261102_admin_announcements', '${name}')`));
  assert.match(rollback, /DROP TABLE IF EXISTS app\.announcements;/u);
  assert.match(rollback, /DELETE FROM app\.migrations WHERE id = '20261102_admin_announcements'/u);
  assert.doesNotMatch(rollback, /DROP SCHEMA/u, "app holds every other table: never drop it");
});

test("like messaging and Notes, the migration is not in the prebuild allowlist", () => {
  assert.doesNotMatch(runner, /admin_announcements/u);
});
