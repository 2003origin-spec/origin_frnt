/**
 * Runtime-ensure DDL vs migrations drift.
 *
 * Many server modules create their tables lazily on first use ("runtime
 * ensure"). A table that exists ONLY there has no migration and no rollback, so
 * run-migrations.mjs, the prod schema audit and any rollback are blind to it.
 * This asserts that every `CREATE TABLE IF NOT EXISTS <name>` under src/ also
 * appears as a CREATE TABLE in some src/db/migrations/*.sql file.
 *
 * KNOWN_RUNTIME_ONLY is the frozen list of gaps that predate this test. It may
 * only shrink: adding a runtime table without a migration fails the first test,
 * and giving a listed table a migration fails the second until it is removed
 * from the list.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const SRC = join(root, "src");
const MIGRATIONS = join(SRC, "db", "migrations");

const KNOWN_RUNTIME_ONLY = new Set([
  "analytics.custom_test_questions",
  "analytics.custom_tests",
  "analytics.dpp_attempts",
  "analytics.dpp_plans",
  "analytics.dpp_questions",
  "analytics.dpp_topic_progress",
  "analytics.test_results",
  "analytics.test_topic_analytics",
  "app.analysis_jobs",
  "app.chapters_cache",
  "app.notifications",
  "notif.device_tokens",
  "ogcode_questions",
  "origin_auth_sessions",
  "origin_ncert_books",
  "origin_ncert_chapters",
  "origin_tasks",
  "origin_users",
  "rooms.room_answer_drafts",
  "rooms.room_codes",
  "rooms.room_messages",
  "rooms.room_participants",
  "rooms.rooms",
]);

/** The four tables 20261022_runtime_only_tables.sql brought under migration. */
const MIGRATED_20261022 = [
  { table: "content.batch_messages", module: "src/server/workspaces/batch-messages-store.ts" },
  { table: "app.batch_topic_coverage", module: "src/server/workspaces/batch-topic-coverage-store.ts" },
  { table: "content.syllabus_nodes", module: "src/server/workspaces/syllabus-schema.ts" },
  { table: "app.premium_event_mode", module: "src/server/premium-access-schema.ts" },
];

// `CREATE TABLE [IF NOT EXISTS] name` followed by whitespace or "(" — so
// interpolated names (`app.${table}`, `contest.%I`) are not captured.
const IDENT = String.raw`"?[a-z_][a-z0-9_]*"?(?:\."?[a-z_][a-z0-9_]*"?)?`;
const RUNTIME_RE = new RegExp(String.raw`CREATE TABLE IF NOT EXISTS\s+(${IDENT})(?=[\s(])`, "gi");
const MIGRATION_RE = new RegExp(String.raw`CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(${IDENT})(?=[\s(])`, "gi");

function normalize(name: string): string {
  return name.replace(/"/g, "").toLowerCase().replace(/^public\./, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function namesIn(text: string, re: RegExp): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(re)) names.add(normalize(match[1]));
  return names;
}

const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && !f.endsWith(".rollback.sql"));
const migrationText = migrationFiles.map((f) => readFileSync(join(MIGRATIONS, f), "utf8")).join("\n");
const migratedTables = namesIn(migrationText, MIGRATION_RE);

const runtimeTables = new Map<string, string>();
for (const file of walk(SRC)) {
  for (const name of namesIn(readFileSync(file, "utf8"), RUNTIME_RE)) {
    if (!runtimeTables.has(name)) runtimeTables.set(name, file.slice(root.length));
  }
}

test("the scan finds the runtime-ensure tables (guards against a regex that matches nothing)", () => {
  assert.ok(runtimeTables.size > 50, `only ${runtimeTables.size} runtime tables found`);
  assert.ok(migratedTables.has("app.migrations"));
});

test("every runtime-ensure CREATE TABLE has a migration (except the frozen legacy list)", () => {
  const missing = [...runtimeTables.entries()]
    .filter(([name]) => !migratedTables.has(name) && !KNOWN_RUNTIME_ONLY.has(name))
    .map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(missing, [], "add a src/db/migrations/<date>_*.sql (+ .rollback.sql) for these tables");
});

test("KNOWN_RUNTIME_ONLY only lists tables that are still runtime-only", () => {
  const stale = [...KNOWN_RUNTIME_ONLY].filter((name) => migratedTables.has(name) || !runtimeTables.has(name));
  assert.deepEqual(stale, [], "remove these from KNOWN_RUNTIME_ONLY");
});

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function createBlock(source: string, table: string): string {
  const start = source.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  assert.ok(start >= 0, `no CREATE TABLE for ${table}`);
  const end = source.indexOf(");", start);
  return source.slice(start, end + 2);
}

for (const { table, module } of MIGRATED_20261022) {
  test(`${table}: 20261022 migration copies the runtime CREATE TABLE verbatim, rollback drops it`, () => {
    assert.equal(KNOWN_RUNTIME_ONLY.has(table), false);
    const runtime = createBlock(readFileSync(join(root, module), "utf8"), table);
    const migration = readFileSync(join(MIGRATIONS, "20261022_runtime_only_tables.sql"), "utf8");
    assert.ok(squash(migration).includes(squash(runtime)), `${table} DDL differs from ${module}`);
    const rollback = readFileSync(join(MIGRATIONS, "20261022_runtime_only_tables.rollback.sql"), "utf8");
    assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS ${table.replace(".", "\\.")};`));
  });
}
