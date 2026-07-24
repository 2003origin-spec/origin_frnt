/**
 * Durable, admin-editable platform settings — app.platform_settings, a tiny
 * Postgres-backed key/value store for configuration that must survive process
 * restarts and Redis flushes and be auditable (unlike the ephemeral, Redis-backed
 * launch-settings.ts). Self-applies on first use; production needs no manual
 * migration. Modeled on src/server/premium-access-schema.ts.
 *
 * Current keys:
 *   - teacher_code_support_phone      (Feature A) — the support number shown to a
 *     teacher after they request code access (D4). Falls back to the
 *     TEACHER_CODE_SUPPORT_PHONE env var, then null.
 *   - allow_deleted_identity_resignup (Feature B) — when 'true', an email/phone
 *     that belongs to an admin-deleted account may be reused to sign up again;
 *     default OFF (the identity stays blocked). See
 *     V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureUserSchema } from "@/server/db-users";

declare global {
  var __originPlatformSettingsEnsured: boolean | undefined;
  var __originPlatformSettingsPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260724_platform_settings";

export const SETTING_TEACHER_CODE_SUPPORT_PHONE = "teacher_code_support_phone";
export const SETTING_ALLOW_DELETED_IDENTITY_RESIGNUP = "allow_deleted_identity_resignup";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "durable admin platform settings — app.platform_settings"],
  );
}

export async function ensurePlatformSettingsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originPlatformSettingsEnsured) return;
  if (!globalThis.__originPlatformSettingsPromise) {
    globalThis.__originPlatformSettingsPromise = (async () => {
      // origin_users (+ the app schema and app.migrations ledger) must exist
      // before the updated_by FK and the ledger insert below validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query("CREATE SCHEMA IF NOT EXISTS app");
        await client.query(`
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS app.platform_settings (
            key        TEXT PRIMARY KEY,
            value      TEXT,
            updated_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originPlatformSettingsEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originPlatformSettingsPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originPlatformSettingsPromise;
}

// Whole-table cache (few keys). Dropped immediately on any write for correctness.
const CACHE_TTL_MS = 30_000;
let cache: { value: Map<string, string | null>; at: number } | null = null;

async function loadAll(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const map = new Map<string, string | null>();
  if (!isUserPostgresConfigured()) {
    cache = { value: map, at: Date.now() };
    return map;
  }
  await ensurePlatformSettingsSchema();
  const res = await pool().query<{ key: string; value: string | null }>(
    "SELECT key, value FROM app.platform_settings",
  );
  for (const row of res.rows) map.set(row.key, row.value);
  cache = { value: map, at: Date.now() };
  return map;
}

/** Raw setting value (or null when unset / Postgres unconfigured). */
export async function getSetting(key: string): Promise<string | null> {
  const map = await loadAll();
  return map.get(key) ?? null;
}

/** Upserts a setting. Pass value=null to clear it. */
export async function setSetting(
  key: string,
  value: string | null,
  updatedBy: string | null,
): Promise<void> {
  await ensurePlatformSettingsSchema();
  await pool().query(
    `INSERT INTO app.platform_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, value, updatedBy],
  );
  cache = null; // correctness backstop — next read refetches
}

// ─── Typed accessors ──────────────────────────────────────────────────────────

/**
 * Support number shown to a teacher after they request code access (Feature A,
 * D4). Falls back to the TEACHER_CODE_SUPPORT_PHONE env var, then null (the UI
 * shows a generic "our team will reach out" message when null).
 */
export async function getTeacherCodeSupportPhone(): Promise<string | null> {
  const stored = await getSetting(SETTING_TEACHER_CODE_SUPPORT_PHONE);
  if (stored && stored.trim()) return stored.trim();
  const env = process.env.TEACHER_CODE_SUPPORT_PHONE?.trim();
  return env && env.length > 0 ? env : null;
}

export async function setTeacherCodeSupportPhone(
  phone: string | null,
  updatedBy: string | null,
): Promise<void> {
  await setSetting(SETTING_TEACHER_CODE_SUPPORT_PHONE, phone && phone.trim() ? phone.trim() : null, updatedBy);
}

/**
 * Whether a deleted account's email/phone may be reused to sign up again
 * (Feature B toggle). Default OFF — the identity stays blocked.
 */
export async function getAllowDeletedIdentityResignup(): Promise<boolean> {
  const stored = await getSetting(SETTING_ALLOW_DELETED_IDENTITY_RESIGNUP);
  return stored === "true";
}

export async function setAllowDeletedIdentityResignup(
  allow: boolean,
  updatedBy: string | null,
): Promise<void> {
  await setSetting(SETTING_ALLOW_DELETED_IDENTITY_RESIGNUP, allow ? "true" : "false", updatedBy);
}
