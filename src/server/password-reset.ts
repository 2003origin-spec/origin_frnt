/**
 * Forgot-password via a 6-digit email OTP (mirrors the CBT login-OTP design).
 *
 * Codes are 6-digit, stored ONLY as a SHA-256 hash in origin_password_reset_otps
 * (USER pool), 15-minute expiry, 5 verify attempts before invalidation, with a
 * resend cooldown. One row per (email, role) — the same email can hold separate
 * student/teacher accounts. On success the OTP is consumed and the account's
 * bcrypt password hash is replaced.
 *
 * Sending goes through the shared transport (SES primary → adminoffice fallback).
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

import { getUserPostgresPool } from "@/server/user-postgres";
import { sendEmail } from "@/server/email";
import { dbFindUserByEmail, dbUpdateUser } from "@/server/db-users";

declare global {
  var __originPasswordResetSchemaReady: Promise<void> | undefined;
}

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS origin_password_reset_otps (
    email        TEXT NOT NULL,
    role         TEXT NOT NULL,
    code_hash    TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, role)
  );
`;

/** Reset is only offered for password accounts (admins use OTP login). */
export type PasswordResetRole = "student" | "teacher";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function ensureSchema(): Promise<void> {
  const p = getUserPostgresPool();
  if (!p) return;
  if (!globalThis.__originPasswordResetSchemaReady) {
    globalThis.__originPasswordResetSchemaReady = p
      .query(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originPasswordResetSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originPasswordResetSchemaReady;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Issue a reset code for (email, role) IF such an account exists, and email it.
 * Never reveals whether the account exists (the caller returns a generic OK) —
 * only sends when the account is real. Enforces a resend cooldown.
 */
export async function requestPasswordReset(
  email: string,
  role: PasswordResetRole,
): Promise<{ sent: boolean; devCode?: string }> {
  await ensureSchema();
  const to = normalize(email);

  const user = await dbFindUserByEmail(to, role);
  if (!user) return { sent: false };

  // DEV-ONLY surfacing: when no mail channel is configured the code is never
  // delivered, so return it for the dev UI. Guarded to non-prod AND no SMTP/SES.
  const devSurface =
    process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST && !process.env.SES_SMTP_HOST;

  const existing = await pool().query<{ last_sent_at: string | null }>(
    "SELECT last_sent_at FROM origin_password_reset_otps WHERE email = $1 AND role = $2",
    [to, role],
  );
  const lastSent = existing.rows[0]?.last_sent_at;
  if (!devSurface && lastSent && Date.now() - new Date(lastSent).getTime() < RESEND_COOLDOWN_MS) {
    return { sent: false };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await pool().query(
    `INSERT INTO origin_password_reset_otps (email, role, code_hash, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, $3, $4, 0, NOW())
     ON CONFLICT (email, role) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = NOW()`,
    [to, role, hashCode(code), expiresAt],
  );

  const result = await sendEmail({
    to,
    subject: "Reset your Origin password",
    text: `Your Origin password reset code is ${code}. It expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #1d4ed8;">Reset your password</h2>
        <p>Use this code to reset the password for your Origin account:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">${code}</div>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This code expires in 15 minutes. If you did not request a password reset, please ignore this email — your password will not change.</p>
      </div>
    `,
  });
  return { sent: result.success, devCode: devSurface ? code : undefined };
}

export type PasswordResetResult = "ok" | "invalid" | "expired" | "locked" | "not_found";

/**
 * Verify a submitted code and, on success, set the new bcrypt password hash.
 * Row-locked so concurrent guesses cannot race the attempt counter. Single-use:
 * the OTP is consumed on success.
 */
export async function verifyAndResetPassword(
  email: string,
  role: PasswordResetRole,
  code: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  await ensureSchema();
  const to = normalize(email);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{ code_hash: string; expires_at: string; attempts: number }>(
      "SELECT code_hash, expires_at, attempts FROM origin_password_reset_otps WHERE email = $1 AND role = $2 FOR UPDATE",
      [to, role],
    );
    const row = res.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return "not_found";
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query("DELETE FROM origin_password_reset_otps WHERE email = $1 AND role = $2", [to, role]);
      await client.query("COMMIT");
      return "expired";
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await client.query("DELETE FROM origin_password_reset_otps WHERE email = $1 AND role = $2", [to, role]);
      await client.query("COMMIT");
      return "locked";
    }
    if (!hashesEqual(row.code_hash, hashCode(code))) {
      await client.query(
        "UPDATE origin_password_reset_otps SET attempts = attempts + 1 WHERE email = $1 AND role = $2",
        [to, role],
      );
      await client.query("COMMIT");
      return "invalid";
    }
    // Code is correct — consume it, then update the account password.
    await client.query("DELETE FROM origin_password_reset_otps WHERE email = $1 AND role = $2", [to, role]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const user = await dbFindUserByEmail(to, role);
  if (!user) return "not_found";
  const hashed = bcrypt.hashSync(newPassword, 10);
  await dbUpdateUser(user.id, { password: hashed });
  return "ok";
}
