/**
 * Email OTP storage — direct, row-scoped SQL on `app.otps`.
 *
 * WHY THIS EXISTS (incident 2026-08-03: "Invalid verification code" on a code
 * the user was actually emailed, intermittently):
 *
 * OTPs used to live in the fully-hydrated AppStore. Every `withStoreAsync()`
 * call — 65 of them across 20 modules, on ordinary paths like task edits and
 * gamification — persists the WHOLE store, and `replaceCollection()` does
 * `DELETE FROM app.<table>` with no WHERE before re-inserting one instance's
 * in-memory snapshot. So any request running concurrently on another serverless
 * instance, holding a snapshot taken before the code was issued, would delete
 * the freshly-minted OTP row and restore its stale copy. The user then typed a
 * code that no longer existed in the database and got "Invalid verification
 * code"; retrying sometimes won the race, which is exactly the reported
 * "sometimes it logs me in".
 *
 * The in-instance `storeMutex` cannot help — it serialises one lambda, not the
 * fleet.
 *
 * Fix: OTPs are read and written ONLY here, one row at a time, keyed by the
 * lower-cased email (the same `id` the store used, so existing rows keep
 * working). `otps` is removed from COLLECTION_SPECS so the full-store rewrite
 * can never touch this table again.
 */

import type { Pool } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originOtpSchemaEnsured: boolean | undefined;
  var __originOtpSchemaPromise: Promise<void> | undefined;
}

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Row key. Callers may pass any casing; storage is always lower-cased. */
function keyOf(email: string): string {
  return email.trim().toLowerCase();
}

export type OtpRecord = {
  email: string;
  otp: string;
  expiresAt: string;
  verified: boolean;
};

/**
 * Column shape matches what the app-store writer created (`LIKE app.streaks`),
 * so this is a no-op against existing databases and only matters for a fresh
 * one now that `otps` no longer has a COLLECTION_SPECS entry to create it.
 */
export async function ensureOtpSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originOtpSchemaEnsured) return;
  if (!globalThis.__originOtpSchemaPromise) {
    globalThis.__originOtpSchemaPromise = (async () => {
      await pool().query(`
        CREATE TABLE IF NOT EXISTS app.otps (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          activity_date DATE,
          subject TEXT,
          completed BOOLEAN,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      globalThis.__originOtpSchemaEnsured = true;
    })().catch((error) => {
      globalThis.__originOtpSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originOtpSchemaPromise;
}

function rowToRecord(row: Record<string, unknown>): OtpRecord {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    email: (data.email as string) ?? (row.id as string),
    otp: String(data.otp ?? ""),
    expiresAt: String(data.expiresAt ?? ""),
    verified: data.verified === true,
  };
}

/**
 * A still-valid, not-yet-verified code for this email, if one exists.
 *
 * Backs the resend path: reusing a live code keeps every already-delivered
 * email valid, instead of minting a new one that silently invalidates the
 * slower first email.
 */
export async function getActiveOtp(email: string): Promise<OtpRecord | null> {
  await ensureOtpSchema();
  const result = await pool().query(
    `SELECT id, data FROM app.otps
      WHERE id = $1
        AND COALESCE(data->>'verified', 'false') <> 'true'
        AND (data->>'expiresAt')::timestamptz > NOW()
      LIMIT 1`,
    [keyOf(email)],
  );
  return result.rows[0] ? rowToRecord(result.rows[0]) : null;
}

/** Issue (or replace) the code for an email. Always starts unverified. */
export async function putOtp(input: {
  email: string;
  otp: string;
  expiresAt: string;
}): Promise<void> {
  await ensureOtpSchema();
  const key = keyOf(input.email);
  await pool().query(
    `INSERT INTO app.otps (id, data, created_at, updated_at)
     VALUES ($1, $2::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET data = EXCLUDED.data, updated_at = NOW()`,
    [
      key,
      JSON.stringify({ email: key, otp: input.otp, expiresAt: input.expiresAt, verified: false }),
    ],
  );
}

export type VerifyOtpOutcome = "ok" | "invalid" | "expired";

/**
 * Consume a code. The state change is a SINGLE guarded UPDATE, so two
 * concurrent verifications of the same code cannot both succeed and neither can
 * be lost to another request's snapshot.
 *
 * On success the row is marked verified and its lifetime extended, because
 * registration completes in a second step that re-checks `verified`.
 */
export async function verifyOtp(
  email: string,
  otp: string,
  verifiedWindowMs = 10 * 60 * 1000,
): Promise<VerifyOtpOutcome> {
  await ensureOtpSchema();
  const key = keyOf(email);
  const newExpiry = new Date(Date.now() + verifiedWindowMs).toISOString();

  const updated = await pool().query(
    `UPDATE app.otps
        SET data = data || jsonb_build_object('verified', true, 'expiresAt', $3::text),
            updated_at = NOW()
      WHERE id = $1
        AND data->>'otp' = $2
        AND (data->>'expiresAt')::timestamptz > NOW()
      RETURNING id`,
    [key, otp, newExpiry],
  );
  if ((updated.rowCount ?? 0) > 0) return "ok";

  // Distinguish "right code, too late" from "wrong code" for the user-facing
  // message. Purely cosmetic: both are refusals.
  const existing = await pool().query(
    `SELECT 1 FROM app.otps WHERE id = $1 AND data->>'otp' = $2 LIMIT 1`,
    [key, otp],
  );
  return (existing.rowCount ?? 0) > 0 ? "expired" : "invalid";
}

/** Whether this email holds a verified, still-live code (registration gate). */
export async function isEmailVerified(email: string): Promise<boolean> {
  await ensureOtpSchema();
  const result = await pool().query(
    `SELECT 1 FROM app.otps
      WHERE id = $1
        AND data->>'verified' = 'true'
        AND (data->>'expiresAt')::timestamptz > NOW()
      LIMIT 1`,
    [keyOf(email)],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Drop the code for an email (after registration, or when it has expired). */
export async function deleteOtp(email: string): Promise<void> {
  await ensureOtpSchema();
  await pool().query(`DELETE FROM app.otps WHERE id = $1`, [keyOf(email)]);
}
