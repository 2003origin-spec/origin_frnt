/**
 * FCM device-token registry — notif.device_tokens (plan §5.5).
 *
 * Runtime-ensured schema (modeled on src/server/premium-access-schema.ts):
 * self-applies on first use, production needs no manual migration. Tokens are
 * upserted on registration; a token that reappears under a different user
 * (shared device, account switch) is REBOUND to the new user — exactly one
 * owner per token at any time, so a logged-out student never receives the
 * next user's notifications (ledger #54).
 *
 * Every helper no-ops when USER_DATABASE_URL is unconfigured (local dev
 * without Postgres) — push is then simply inactive.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originDeviceTokensEnsured: boolean | undefined;
  var __originDeviceTokensPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260718_mobile_device_tokens";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  try {
    await client.query(
      "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [MIGRATION_ID, "android app — notif.device_tokens push registry"],
    );
  } catch {
    // Fresh dev databases may not have app.migrations yet; the DDL below is
    // idempotent either way.
  }
}

export async function ensureDeviceTokensSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originDeviceTokensEnsured) return;
  if (!globalThis.__originDeviceTokensPromise) {
    globalThis.__originDeviceTokensPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query("CREATE SCHEMA IF NOT EXISTS notif");
        await client.query(`
          CREATE TABLE IF NOT EXISTS notif.device_tokens (
            token            text PRIMARY KEY,
            user_id          text NOT NULL,
            platform         text NOT NULL DEFAULT 'android',
            app_version_code integer,
            created_at       timestamptz NOT NULL DEFAULT now(),
            last_seen_at     timestamptz NOT NULL DEFAULT now(),
            revoked_at       timestamptz
          )
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS device_tokens_active_user_idx
            ON notif.device_tokens (user_id)
            WHERE revoked_at IS NULL
        `);
        await recordMigration(client);
        globalThis.__originDeviceTokensEnsured = true;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originDeviceTokensPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originDeviceTokensPromise;
}

export type DeviceTokenInput = {
  userId: string;
  token: string;
  platform?: string;
  appVersionCode?: number | null;
};

export async function registerDeviceToken(input: DeviceTokenInput): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureDeviceTokensSchema();
  await pool().query(
    `INSERT INTO notif.device_tokens (token, user_id, platform, app_version_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       app_version_code = EXCLUDED.app_version_code,
       last_seen_at = now(),
       revoked_at = NULL`,
    [input.token, input.userId, input.platform ?? "android", input.appVersionCode ?? null],
  );
}

/** Revoke one token (explicit unregister from the shell). */
export async function revokeDeviceToken(token: string): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureDeviceTokensSchema();
  await pool().query("UPDATE notif.device_tokens SET revoked_at = now() WHERE token = $1", [token]);
}

/** Revoke every token bound to a user (logout / account deletion). */
export async function revokeDeviceTokensForUser(userId: string): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureDeviceTokensSchema();
  await pool().query(
    "UPDATE notif.device_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
}

export async function listActiveDeviceTokens(userId: string): Promise<string[]> {
  if (!isUserPostgresConfigured()) return [];
  await ensureDeviceTokensSchema();
  const result = await pool().query<{ token: string }>(
    "SELECT token FROM notif.device_tokens WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
  return result.rows.map((row) => row.token);
}

/** Hard-delete a token FCM reported as UNREGISTERED/invalid. */
export async function pruneDeviceToken(token: string): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureDeviceTokensSchema();
  await pool().query("DELETE FROM notif.device_tokens WHERE token = $1", [token]);
}
