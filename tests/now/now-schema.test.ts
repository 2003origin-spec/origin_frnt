/**
 * The Origin NOW migration file and the runtime ensure must not drift: the
 * migration is generated from NOW_SCHEMA_DDL, and this test fails if either is
 * edited alone. It also pins the safety properties the plan relies on.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NOW_ADDON_MIGRATIONS, NOW_MIGRATION_ID, NOW_SCHEMA_DDL } from "@/server/now/now-schema";

const root = new URL("../..", import.meta.url).pathname;
const migration = readFileSync(join(root, "src/db/migrations", `${NOW_MIGRATION_ID}.sql`), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations", `${NOW_MIGRATION_ID}.rollback.sql`), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

test("every runtime DDL statement appears verbatim in the migration file", () => {
  for (const statement of NOW_SCHEMA_DDL) {
    assert.ok(migration.includes(statement), `migration is missing:\n${statement.slice(0, 120)}`);
  }
});

test("every statement is idempotent", () => {
  for (const statement of NOW_SCHEMA_DDL) {
    const creates = statement.match(/CREATE (UNIQUE )?(TABLE|INDEX|SCHEMA)\b(?! IF NOT EXISTS)/g);
    assert.equal(creates, null, `non-idempotent CREATE in:\n${statement.slice(0, 120)}`);
    assert.doesNotMatch(statement, /\bDROP\b/, "the forward migration never drops anything");
  }
});

test("the migration is not auto-applied to production yet (decision B2)", () => {
  assert.doesNotMatch(runner, new RegExp(NOW_MIGRATION_ID));
});

test("the rollback removes both schemas and the ledger row", () => {
  assert.match(rollback, /DROP SCHEMA IF EXISTS now CASCADE/);
  assert.match(rollback, /DROP SCHEMA IF EXISTS store CASCADE/);
  assert.match(rollback, new RegExp(`DELETE FROM app.migrations WHERE id = '${NOW_MIGRATION_ID}'`));
});

test("the database itself enforces one open request per student and one live session per helper", () => {
  const ddl = NOW_SCHEMA_DDL.join("\n");
  assert.match(ddl, /uq_requests_one_open_per_student[\s\S]*WHERE status IN \('requested', 'offered', 'accepted', 'live'\)/);
  assert.match(ddl, /uq_sessions_one_live_per_human_helper[\s\S]*WHERE ended_at IS NULL AND solver_kind = 'human'/);
  assert.match(ddl, /uq_offers_one_open_per_request[\s\S]*WHERE response IS NULL/);
  assert.match(ddl, /idempotency_key TEXT NOT NULL UNIQUE/);
});

test("each add-on migration file mirrors its runtime DDL and is not auto-applied", () => {
  for (const addon of NOW_ADDON_MIGRATIONS) {
    const file = readFileSync(join(root, "src/db/migrations", `${addon.id}.sql`), "utf8");
    const back = readFileSync(join(root, "src/db/migrations", `${addon.id}.rollback.sql`), "utf8");
    for (const statement of addon.ddl) {
      assert.ok(file.includes(statement), `${addon.id} is missing:\n${statement.slice(0, 120)}`);
      assert.doesNotMatch(statement, /\bDROP\b/);
    }
    assert.match(file, new RegExp(`INSERT INTO app.migrations[\\s\\S]*'${addon.id}'`));
    assert.match(back, new RegExp(`DELETE FROM app.migrations WHERE id = '${addon.id}'`));
    assert.doesNotMatch(runner, new RegExp(addon.id));
  }
});
