/**
 * Admin announcements — runtime schema ensure for `app.announcements` (USER database).
 *
 * Mirrors src/db/migrations/20261102_admin_announcements.sql statement for
 * statement; tests/unit/announcements-schema.test.ts pins the two together.
 * Like messaging, Notes and Origin NOW, the migration is NOT in the prebuild
 * allowlist (scripts/run-migrations.mjs): prod gets the table the first time
 * the admin page is used, or by running the SQL by hand on Neon.
 *
 * One row per send (tests included). The row is written BEFORE delivery, so a
 * second click during a send already sees it (double-send guard); the counts
 * and `finished_at` are filled in when delivery ends.
 */

import { ensureUserSchema } from "@/server/db-users";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originAnnouncementsSchemaEnsured: boolean | undefined;
  var __originAnnouncementsSchemaPromise: Promise<void> | undefined;
}

export const ANNOUNCEMENTS_MIGRATION_ID = "20261102_admin_announcements";
export const ANNOUNCEMENTS_MIGRATION_NAME = "admin announcements — app.announcements send log";

export const ANNOUNCEMENTS_SCHEMA_DDL: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS app`,
  `CREATE TABLE IF NOT EXISTS app.announcements (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 65),
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  link           TEXT NOT NULL DEFAULT '/' CHECK (char_length(link) BETWEEN 1 AND 200 AND left(link, 1) = '/'),
  audience       JSONB NOT NULL,
  sent_by        TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  test           BOOLEAN NOT NULL DEFAULT false,
  recipients     INTEGER NOT NULL DEFAULT 0 CHECK (recipients >= 0),
  push_attempted INTEGER NOT NULL DEFAULT 0 CHECK (push_attempted >= 0),
  push_delivered INTEGER NOT NULL DEFAULT 0 CHECK (push_delivered >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
)`,
  `CREATE INDEX IF NOT EXISTS app_announcements_created_idx ON app.announcements (created_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS app_announcements_sender_idx ON app.announcements (sent_by, created_at DESC)`,
];

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureAnnouncementsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originAnnouncementsSchemaEnsured) return;
  if (!globalThis.__originAnnouncementsSchemaPromise) {
    globalThis.__originAnnouncementsSchemaPromise = (async () => {
      // origin_users must exist before the sent_by FK can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // One shared lock for all runtime DDL (see src/server/schema-lock.ts).
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        for (const statement of ANNOUNCEMENTS_SCHEMA_DDL) {
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
          [ANNOUNCEMENTS_MIGRATION_ID, ANNOUNCEMENTS_MIGRATION_NAME],
        );
        await client.query("COMMIT");
        globalThis.__originAnnouncementsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originAnnouncementsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originAnnouncementsSchemaPromise;
}
