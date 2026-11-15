/**
 * The runtime ensure (src/server/music/schema.ts) and the migration file must
 * stay identical, statement for statement — prod may get either one; the
 * rollback must drop everything the migration created. Read as text so this
 * stays a pure unit test. V1/STUDY_MUSIC_PLAN.md §4.4, §11.1.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MUSIC_ARTIST_MAX,
  MUSIC_ATTRIBUTION_MAX,
  MUSIC_AUDIO_MAX_BYTES,
  MUSIC_DURATION_MAX_S,
  MUSIC_DURATION_MIN_S,
  MUSIC_LICENCE_NAME_MAX,
  MUSIC_MOODS,
  MUSIC_TITLE_MAX,
  MUSIC_URL_MAX,
} from "../../src/lib/study-music";

const root = new URL("../..", import.meta.url).pathname;
const runtime = readFileSync(join(root, "src/server/music/schema.ts"), "utf8");
const migration = readFileSync(join(root, "src/db/migrations/20261114_study_music.sql"), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations/20261114_study_music.rollback.sql"), "utf8");
const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");

function runtimeStatements(): string[] {
  const start = runtime.indexOf("MUSIC_SCHEMA_DDL: readonly string[]");
  const block = runtime.slice(start, runtime.indexOf("];", start));
  return [...block.matchAll(/`([\s\S]*?)`/gu)].map((m) => m[1]);
}

/** The migration's statements, minus the shared app.migrations ledger lines. */
function migrationStatements(): string[] {
  return migration
    .replace(/^--.*$/gmu, "")
    .split(/;\s*\n/u)
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("app.migrations"));
}

test("runtime DDL equals the migration, statement for statement, in order", () => {
  const statements = runtimeStatements();
  assert.equal(statements.length, 6, `expected the full DDL list, got ${statements.length}`);
  assert.deepEqual(statements, migrationStatements());
});

test("the DDL is idempotent and additive", () => {
  for (const statement of runtimeStatements()) {
    assert.match(statement, /IF NOT EXISTS/u, statement.slice(0, 60));
    assert.doesNotMatch(statement.replace(/ON DELETE (CASCADE|SET NULL)/gu, ""), /\bDROP\b|\bALTER\b|\bDELETE\b/u);
  }
});

test("the table limits match the validation rules", () => {
  assert.match(migration, new RegExp(`char_length\\(title\\) BETWEEN 1 AND ${MUSIC_TITLE_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(artist\\) BETWEEN 1 AND ${MUSIC_ARTIST_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(licence_name\\) BETWEEN 1 AND ${MUSIC_LICENCE_NAME_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(attribution_text\\) BETWEEN 1 AND ${MUSIC_ATTRIBUTION_MAX}\\b`, "u"));
  assert.match(migration, new RegExp(`duration_seconds BETWEEN ${MUSIC_DURATION_MIN_S} AND ${MUSIC_DURATION_MAX_S}\\b`, "u"));
  assert.match(migration, new RegExp(`size_bytes BETWEEN 1 AND ${MUSIC_AUDIO_MAX_BYTES}\\b`, "u"));
  assert.match(migration, new RegExp(`char_length\\(source_url\\) <= ${MUSIC_URL_MAX}\\b`, "u"));
  const moods = MUSIC_MOODS.map((m) => `'${m}'`).join(",");
  assert.equal(migration.split(`IN (${moods})`).length - 1, 2, "tracks.mood and user_prefs.default_mood");
  assert.match(migration, /mime_type IN \('audio\/mp4','audio\/mpeg'\)/u);
});

test("user ids are TEXT with a foreign key to origin_users, like app.announcements.sent_by", () => {
  assert.match(migration, /user_id\s+TEXT PRIMARY KEY REFERENCES origin_users\(id\)/u);
  assert.match(migration, /user_id\s+TEXT NOT NULL REFERENCES origin_users\(id\)/u);
  assert.match(migration, /created_by\s+TEXT REFERENCES origin_users\(id\) ON DELETE SET NULL/u);
});

test("the migration records itself with the runtime's id and name", () => {
  assert.match(runtime, /MUSIC_MIGRATION_ID = "20261114_study_music"/u);
  const name = /MUSIC_MIGRATION_NAME = "([^"]+)"/u.exec(runtime)?.[1];
  assert.ok(name);
  assert.ok(migration.includes(`VALUES ('20261114_study_music', '${name}')`));
});

test("the rollback drops everything the migration created, children first", () => {
  const created = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS (music\.\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(created, ["music.tracks", "music.user_prefs", "music.listen_sessions"]);
  const dropped = [...rollback.matchAll(/DROP TABLE IF EXISTS (music\.\w+);/gu)].map((m) => m[1]);
  assert.deepEqual(dropped, ["music.listen_sessions", "music.user_prefs", "music.tracks"]);
  assert.match(rollback, /DROP SCHEMA IF EXISTS music;/u);
  assert.doesNotMatch(rollback, /CASCADE/u, "no CASCADE: never drop something the migration did not create");
  assert.match(rollback, /DELETE FROM app\.migrations WHERE id = '20261114_study_music'/u);
});

test("like announcements and Notes, the migration is not in the prebuild allowlist", () => {
  assert.doesNotMatch(runner, /study_music/u);
});
