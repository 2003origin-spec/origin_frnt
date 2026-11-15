/**
 * Study Music — runtime schema ensure for the `music` schema (USER database).
 *
 * Mirrors src/db/migrations/20261114_study_music.sql statement for statement;
 * tests/unit/study-music-schema.test.ts pins the two together. Like
 * announcements, messaging, Notes and Origin NOW, the migration is NOT in the
 * prebuild allowlist (scripts/run-migrations.mjs): prod gets the schema the
 * first time /admin/music or a music API is used, or by running the SQL by
 * hand on Neon. Plan: V1/STUDY_MUSIC_PLAN.md §4.4.
 *
 * user_id / created_by are TEXT with a foreign key to origin_users(id), the
 * same type and pattern as app.announcements.sent_by. Accounts are anonymised,
 * not deleted, so src/server/account-deletion.ts removes the music rows
 * itself; the CASCADE only matters for a hard delete.
 */

import { ensureUserSchema } from "@/server/db-users";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originMusicSchemaEnsured: boolean | undefined;
  var __originMusicSchemaPromise: Promise<void> | undefined;
}

export const MUSIC_MIGRATION_ID = "20261114_study_music";
export const MUSIC_MIGRATION_NAME = "study music — music.tracks, user_prefs, listen_sessions";

export const MUSIC_SCHEMA_DDL: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS music`,
  `CREATE TABLE IF NOT EXISTS music.tracks (
  id                   UUID PRIMARY KEY,
  title                TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  artist               TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80),
  mood                 TEXT NOT NULL CHECK (mood IN ('lofi','instrumental','nature','white_noise')),
  duration_seconds     INTEGER NOT NULL CHECK (duration_seconds BETWEEN 20 AND 1200),
  loopable             BOOLEAN NOT NULL DEFAULT false,
  allow_offline        BOOLEAN NOT NULL DEFAULT true,
  object_key           TEXT NOT NULL UNIQUE,
  mime_type            TEXT NOT NULL CHECK (mime_type IN ('audio/mp4','audio/mpeg')),
  size_bytes           BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 15728640),
  sha256               TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  source_url           TEXT NOT NULL CHECK (source_url ~ '^https://' AND char_length(source_url) <= 500),
  licence_name         TEXT NOT NULL CHECK (char_length(licence_name) BETWEEN 1 AND 80),
  licence_url          TEXT NOT NULL CHECK (licence_url ~ '^https://' AND char_length(licence_url) <= 500),
  attribution_required BOOLEAN NOT NULL DEFAULT true,
  attribution_text     TEXT NOT NULL CHECK (char_length(attribution_text) BETWEEN 1 AND 300),
  licence_proof_key    TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_by           TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at         TIMESTAMPTZ
)`,
  `CREATE INDEX IF NOT EXISTS music_tracks_published_idx ON music.tracks (mood, sort_order) WHERE status = 'published'`,
  `CREATE TABLE IF NOT EXISTS music.user_prefs (
  user_id            TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  pause_during_tests BOOLEAN NOT NULL DEFAULT true,
  default_mood       TEXT NOT NULL DEFAULT 'lofi' CHECK (default_mood IN ('lofi','instrumental','nature','white_noise')),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS music.listen_sessions (
  id            UUID PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  track_id      UUID NOT NULL REFERENCES music.tracks(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('web','android')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  seconds       INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  focus_seconds INTEGER NOT NULL DEFAULT 0 CHECK (focus_seconds >= 0 AND focus_seconds <= seconds),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS music_listen_user_day_idx ON music.listen_sessions (user_id, started_at)`,
];

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureMusicSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originMusicSchemaEnsured) return;
  if (!globalThis.__originMusicSchemaPromise) {
    globalThis.__originMusicSchemaPromise = (async () => {
      // origin_users must exist before the user_id / created_by FKs can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // One shared lock for all runtime DDL (see src/server/schema-lock.ts).
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        for (const statement of MUSIC_SCHEMA_DDL) {
          await client.query(statement);
        }
        // ensureUserSchema() creates `app` but not the ledger table on a fresh DB.
        await client.query(`
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [MUSIC_MIGRATION_ID, MUSIC_MIGRATION_NAME],
        );
        await client.query("COMMIT");
        globalThis.__originMusicSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originMusicSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originMusicSchemaPromise;
}
