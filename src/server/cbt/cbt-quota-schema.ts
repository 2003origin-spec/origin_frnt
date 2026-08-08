/**
 * Idempotent runtime ensure for the CBT participation-quota tables.
 * Canonical SQL: src/db/migrations/20260808_cbt_participation_quota.sql
 *
 * Self-applies on first use so a preview deploy with no build-time
 * USER_DATABASE_URL still works. The `cbt.teachers` grant columns live in
 * ensureCbtSchema (so every teacher read/insert always has them); this module
 * owns only the two new tables. See V1/CBT_PARTICIPATION_QUOTA_PLAN.md.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureCbtSchema } from "./cbt-schema";

declare global {
  var __originCbtQuotaSchemaEnsured: boolean | undefined;
  var __originCbtQuotaSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260808_cbt_participation_quota";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "cbt participation quota — teacher caps + participation ledger + requests"],
  );
}

export async function ensureCbtQuotaSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originCbtQuotaSchemaEnsured) return;
  if (!globalThis.__originCbtQuotaSchemaPromise) {
    globalThis.__originCbtQuotaSchemaPromise = (async () => {
      // cbt.teachers (+ its quota columns) and app.migrations must exist first.
      await ensureCbtSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`
          -- Append-only participation meter. No FK to cbt.rooms /
          -- cbt.room_participants ON PURPOSE: deleting a room must not restore
          -- a teacher's consumed quota (the room DELETE cascades to
          -- room_participants, so a derived count would be self-resettable).
          CREATE TABLE IF NOT EXISTS cbt.participation_ledger (
            participant_id TEXT PRIMARY KEY,
            teacher_id     TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            room_id        TEXT NOT NULL,
            room_name      TEXT,
            display_name   TEXT,
            student_code   TEXT,
            counted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_cbt_participation_ledger_teacher
            ON cbt.participation_ledger (teacher_id, counted_at DESC);
          CREATE INDEX IF NOT EXISTS idx_cbt_participation_ledger_room
            ON cbt.participation_ledger (room_id);

          CREATE TABLE IF NOT EXISTS cbt.participation_requests (
            id                   TEXT PRIMARY KEY,
            teacher_id           TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            requested_by         TEXT,
            requested_additional INTEGER NOT NULL CHECK (requested_additional > 0),
            note                 TEXT,
            status               TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
            used_at_request      INTEGER NOT NULL DEFAULT 0,
            quota_at_request     INTEGER,
            granted_quota        INTEGER,
            admin_note           TEXT,
            decided_by           TEXT,
            decided_at           TIMESTAMPTZ,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- At most one open request per teacher.
          CREATE UNIQUE INDEX IF NOT EXISTS uq_cbt_participation_request_pending
            ON cbt.participation_requests (teacher_id) WHERE status = 'pending';
          CREATE INDEX IF NOT EXISTS idx_cbt_participation_requests_status
            ON cbt.participation_requests (status, created_at DESC);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originCbtQuotaSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originCbtQuotaSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originCbtQuotaSchemaPromise;
}
