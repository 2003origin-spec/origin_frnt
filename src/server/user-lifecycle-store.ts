/**
 * Feature B primitives — the deleted-identity blocklist. When an admin deletes a
 * user (retain name/email/phone tombstone), their email + mobile go here so the
 * same identity can't sign up again, unless the admin toggles
 * allow_deleted_identity_resignup (platform-settings). Enforcement in the auth
 * handlers is UNCONDITIONAL (never behind the adminUserLifecycle flag).
 * Canonical SQL: src/db/migrations/20260724_user_lifecycle.sql.
 * See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { ensureUserSchema } from "@/server/db-users";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originUserLifecycleSchemaEnsured: boolean | undefined;
  var __originUserLifecycleSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260724_user_lifecycle";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Lowercased, trimmed email — matches the register/login lookup key. */
export function normalizeEmailForBlock(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 ? e : null;
}

/** 10-digit Indian mobile (strips a leading +91/91) — matches dbCreateUser's form. */
export function normalizeMobileForBlock(mobile: string | null | undefined): string | null {
  const digits = String(mobile ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "admin user lifecycle — app.deleted_identity_blocklist"],
  );
}

export async function ensureUserLifecycleSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originUserLifecycleSchemaEnsured) return;
  if (!globalThis.__originUserLifecycleSchemaPromise) {
    globalThis.__originUserLifecycleSchemaPromise = (async () => {
      await ensureUserSchema(); // origin_users + app.migrations must exist first.
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query("CREATE SCHEMA IF NOT EXISTS app");
        await client.query(`
          CREATE TABLE IF NOT EXISTS app.deleted_identity_blocklist (
            id          TEXT PRIMARY KEY,
            user_id     TEXT,
            email_norm  TEXT,
            mobile_norm TEXT,
            reason      TEXT,
            deleted_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS idx_deleted_blocklist_email
            ON app.deleted_identity_blocklist(email_norm) WHERE email_norm IS NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_deleted_blocklist_mobile
            ON app.deleted_identity_blocklist(mobile_norm) WHERE mobile_norm IS NOT NULL;
        `);
        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originUserLifecycleSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originUserLifecycleSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originUserLifecycleSchemaPromise;
}

/**
 * True if the given email OR mobile belongs to an admin-deleted identity.
 * Returns false when Postgres is unconfigured (dev store handles its own path).
 */
export async function isIdentityBlocked(
  email: string | null | undefined,
  mobile: string | null | undefined,
): Promise<boolean> {
  if (!isUserPostgresConfigured()) return false;
  const emailNorm = normalizeEmailForBlock(email);
  const mobileNorm = normalizeMobileForBlock(mobile);
  if (!emailNorm && !mobileNorm) return false;
  await ensureUserLifecycleSchema();
  const res = await pool().query(
    `SELECT 1 FROM app.deleted_identity_blocklist
      WHERE (email_norm IS NOT NULL AND email_norm = $1)
         OR (mobile_norm IS NOT NULL AND mobile_norm = $2)
      LIMIT 1`,
    [emailNorm, mobileNorm],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Records a deleted identity in the blocklist (idempotent per (email, mobile)). */
export async function addIdentityToBlocklist(input: {
  userId: string;
  email: string | null;
  mobile: string | null;
  reason: string | null;
  deletedBy: string | null;
  client?: PoolClient;
}): Promise<void> {
  await ensureUserLifecycleSchema();
  const runner = input.client ?? pool();
  await runner.query(
    `INSERT INTO app.deleted_identity_blocklist (id, user_id, email_norm, mobile_norm, reason, deleted_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      `dblk_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      input.userId,
      normalizeEmailForBlock(input.email),
      normalizeMobileForBlock(input.mobile),
      input.reason,
      input.deletedBy,
    ],
  );
}
