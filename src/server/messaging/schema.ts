/**
 * Student messaging — runtime schema ensure for the `messaging` schema (USER database).
 *
 * Mirrors src/db/migrations/20261101_student_messaging.sql statement for
 * statement; tests/unit/messaging-schema.test.ts pins the two together. Like
 * Notes and Origin NOW, the migration is NOT in the prebuild allowlist
 * (scripts/run-migrations.mjs): prod gets the schema the first time messaging
 * code runs, or by running the SQL by hand on Neon.
 *
 * Tables:
 *   conversations — one per pair of students (user_a < user_b), with the
 *                   request status, who asked, who blocked, and timestamps.
 *   members       — per-user read marker + "a message notification is
 *                   waiting" switch (dedupes new-message notifications).
 *   messages      — the text, its units, and the IST day it counted against.
 *   daily_usage   — units used per student per IST day; the cap is ONE
 *                   conditional UPDATE here, so parallel sends can't pass it.
 *   blocks        — who blocked whom.
 *   reports       — reason + note, for admins; resolution (dismiss / warn /
 *                   suspend) + admin note once resolved.
 *   suspensions   — admin pauses on starting/sending messages (reads stay).
 *
 * The addendum columns (02/11/2026) are `ALTER TABLE … ADD COLUMN IF NOT
 * EXISTS`, so a database that already ran the first version picks them up.
 */

import { ensureUserSchema } from "@/server/db-users";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originMessagingSchemaEnsured: boolean | undefined;
  var __originMessagingSchemaPromise: Promise<void> | undefined;
}

export const MESSAGING_MIGRATION_ID = "20261101_student_messaging";
export const MESSAGING_MIGRATION_NAME = "student messaging — requests, messages, daily units, blocks, reports, suspensions";

export const MESSAGING_SCHEMA_DDL: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS messaging`,
  `CREATE TABLE IF NOT EXISTS messaging.conversations (
  id              TEXT PRIMARY KEY,
  user_a          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  user_b          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  requested_by    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
  blocked_by      TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  blocked_at      TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  CHECK (user_a < user_b),
  CHECK (requested_by IN (user_a, user_b)),
  UNIQUE (user_a, user_b)
)`,
  `CREATE INDEX IF NOT EXISTS messaging_conversations_a_idx ON messaging.conversations (user_a, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS messaging_conversations_b_idx ON messaging.conversations (user_b, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS messaging.members (
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  notice_pending  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
)`,
  `CREATE INDEX IF NOT EXISTS messaging_members_user_idx ON messaging.members (user_id)`,
  `CREATE TABLE IF NOT EXISTS messaging.messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  units           SMALLINT NOT NULL CHECK (units >= 1),
  ist_day         DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS messaging_messages_conversation_idx
  ON messaging.messages (conversation_id, created_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS messaging_messages_sender_day_idx ON messaging.messages (sender_id, ist_day)`,
  `CREATE TABLE IF NOT EXISTS messaging.daily_usage (
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  ist_day    DATE NOT NULL,
  units      INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ist_day)
)`,
  `CREATE TABLE IF NOT EXISTS messaging.blocks (
  blocker_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
)`,
  `CREATE INDEX IF NOT EXISTS messaging_blocks_blocked_idx ON messaging.blocks (blocked_id)`,
  `CREATE TABLE IF NOT EXISTS messaging.reports (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  reporter_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reported_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL CHECK (reason IN ('spam','abuse','inappropriate','other')),
  note            TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT REFERENCES origin_users(id) ON DELETE SET NULL
)`,
  `CREATE INDEX IF NOT EXISTS messaging_reports_status_idx ON messaging.reports (status, created_at DESC)`,
  // Addendum 02/11/2026: unblock restores the status a block replaced.
  `ALTER TABLE messaging.conversations ADD COLUMN IF NOT EXISTS status_before_block TEXT
  CHECK (status_before_block IN ('pending','accepted','declined'))`,
  // Addendum 02/11/2026: an admin resolves a report with dismiss / warn / suspend.
  `ALTER TABLE messaging.reports ADD COLUMN IF NOT EXISTS resolution TEXT
  CHECK (resolution IN ('dismiss','warn','suspend'))`,
  `ALTER TABLE messaging.reports ADD COLUMN IF NOT EXISTS resolution_note TEXT
  CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000)`,
  `CREATE TABLE IF NOT EXISTS messaging.suspensions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  report_id  TEXT REFERENCES messaging.reports(id) ON DELETE SET NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
)`,
  `CREATE INDEX IF NOT EXISTS messaging_suspensions_user_idx ON messaging.suspensions (user_id, ends_at DESC)`,
];

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureMessagingSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originMessagingSchemaEnsured) return;
  if (!globalThis.__originMessagingSchemaPromise) {
    globalThis.__originMessagingSchemaPromise = (async () => {
      // origin_users must exist before the FKs below can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // One shared lock for all runtime DDL (see src/server/schema-lock.ts).
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        for (const statement of MESSAGING_SCHEMA_DDL) {
          await client.query(statement);
        }
        // ensureUserSchema() creates `app` but not the ledger table on a fresh DB.
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [MESSAGING_MIGRATION_ID, MESSAGING_MIGRATION_NAME],
        );
        await client.query("COMMIT");
        globalThis.__originMessagingSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originMessagingSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originMessagingSchemaPromise;
}
