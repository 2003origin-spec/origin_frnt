/**
 * Idempotent runtime ensure + state helpers for the admin Premium Pro access
 * "Event Mode" — app.premium_event_mode (a single-row global flag).
 *
 * While Event Mode is ON, students who sign up during a launch/marketing event
 * are auto-granted Premium Pro (an admin_comp grant) by the registration hook, so
 * new signups during the buzz get the full plan without the admin re-running
 * "select all free". The row also carries an optional auto-revert time applied to
 * those signup grants. Self-applies on first use — production needs no manual
 * migration. Modeled on src/server/ai-access-schema.ts.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureEnrollmentSchema } from "@/server/workspaces/enrollment-schema";

declare global {
  var __originPremiumEventModeEnsured: boolean | undefined;
  var __originPremiumEventModePromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260709_premium_event_mode";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "admin premium access — app.premium_event_mode"],
  );
}

export async function ensurePremiumEventModeSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originPremiumEventModeEnsured) return;
  if (!globalThis.__originPremiumEventModePromise) {
    globalThis.__originPremiumEventModePromise = (async () => {
      // origin_users (+ the app schema and app.migrations ledger) must exist
      // before the updated_by FK and the ledger insert below validate.
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`
          CREATE TABLE IF NOT EXISTS app.premium_event_mode (
            id             BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
            active         BOOLEAN NOT NULL DEFAULT FALSE,
            auto_revert_at TIMESTAMPTZ,
            updated_by     TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);

        await client.query(`
          INSERT INTO app.premium_event_mode (id, active)
          VALUES (TRUE, FALSE)
          ON CONFLICT (id) DO NOTHING;
        `);

        // The admin free/premium counts + roster filter on (role, is_premium);
        // idempotent — ai-access-schema also owns this index.
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_origin_users_role_premium
            ON origin_users (role, is_premium);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originPremiumEventModeEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originPremiumEventModePromise = undefined;
      throw error;
    });
  }
  await globalThis.__originPremiumEventModePromise;
}

export type EventMode = {
  active: boolean;
  autoRevertAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

const EVENT_MODE_OFF: EventMode = { active: false, autoRevertAt: null, updatedBy: null, updatedAt: null };

function rowToEventMode(row: Record<string, unknown>): EventMode {
  return {
    active: Boolean(row.active),
    autoRevertAt: row.auto_revert_at ? new Date(row.auto_revert_at as string).toISOString() : null,
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : null,
  };
}

// Short in-process cache so the registration signup path is not a DB round-trip
// per signup. Correctness backstop: the cache is dropped immediately on setEventMode.
const CACHE_TTL_MS = 30_000;
let cache: { value: EventMode; at: number } | null = null;

/** Current Event Mode state. Cached ~30s; returns OFF when Postgres is unconfigured. */
export async function getEventMode(): Promise<EventMode> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  if (!isUserPostgresConfigured()) return EVENT_MODE_OFF;
  await ensurePremiumEventModeSchema();
  const res = await pool().query(
    `SELECT active, auto_revert_at, updated_by, updated_at FROM app.premium_event_mode WHERE id = TRUE`,
  );
  const value = res.rows[0] ? rowToEventMode(res.rows[0]) : EVENT_MODE_OFF;
  cache = { value, at: Date.now() };
  return value;
}

/** Sets Event Mode on/off (+ optional auto-revert applied to new-signup grants). */
export async function setEventMode(input: {
  active: boolean;
  autoRevertAt?: string | null;
  updatedBy: string | null;
}): Promise<EventMode> {
  await ensurePremiumEventModeSchema();
  const res = await pool().query(
    `INSERT INTO app.premium_event_mode (id, active, auto_revert_at, updated_by, updated_at)
     VALUES (TRUE, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE
       SET active = EXCLUDED.active,
           auto_revert_at = EXCLUDED.auto_revert_at,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING active, auto_revert_at, updated_by, updated_at`,
    [input.active, input.autoRevertAt ?? null, input.updatedBy ?? null],
  );
  const value = rowToEventMode(res.rows[0]);
  cache = { value, at: Date.now() };
  return value;
}
