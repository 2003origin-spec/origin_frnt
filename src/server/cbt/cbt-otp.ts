/**
 * Self-contained OTP store for the CBT teacher login flow (no legacy store).
 * Codes are 6-digit (crypto.randomInt), stored only as a SHA-256 hash in
 * cbt.login_otps, 5-minute expiry, 5 verify attempts before invalidation,
 * with a short resend cooldown. One row per email (PK).
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { getUserPostgresPool } from "@/server/user-postgres";
import { sendEmail } from "@/server/email";

import { ensureCbtSchema } from "./cbt-schema";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
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
 * Issues (or rotates) an OTP for the email and emails it. Enforces a short
 * resend cooldown to prevent inbox spam. Returns whether an email was sent
 * (callers should not surface this to avoid leaking allowlist membership).
 */
export async function issueCbtOtp(email: string): Promise<{ sent: boolean; devCode?: string }> {
  await ensureCbtSchema();
  const to = normalize(email);
  // DEV-ONLY: when no SMTP is configured the code is never delivered, so we
  // return it to the caller (which surfaces it in the login UI). Guarded to
  // non-production AND missing SMTP so it can NEVER leak in a real deployment.
  const devSurface = process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST;

  const existing = await pool().query<{ last_sent_at: string | null }>(
    "SELECT last_sent_at FROM cbt.login_otps WHERE email = $1",
    [to],
  );
  const lastSent = existing.rows[0]?.last_sent_at;
  // In dev-surface mode skip the cooldown so a fresh code is always minted and
  // returned — otherwise the returned code could mismatch the stored one.
  if (!devSurface && lastSent && Date.now() - new Date(lastSent).getTime() < RESEND_COOLDOWN_MS) {
    // Within cooldown — do not rotate or resend (anti-spam / anti-rotation).
    return { sent: false };
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await pool().query(
    `INSERT INTO cbt.login_otps (email, code_hash, expires_at, attempts, last_sent_at, verified_at)
       VALUES ($1, $2, $3, 0, NOW(), NULL)
     ON CONFLICT (email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = NOW(),
       verified_at = NULL`,
    [to, codeHash, expiresAt],
  );

  const result = await sendEmail({
    to,
    subject: "Your CBT sign-in code",
    text: `Your CBT verification code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #1d4ed8;">CBT sign in</h2>
        <p>Use this code to sign in to your CBT teacher account:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">${code}</div>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">This code expires in 5 minutes. If you did not request it, please ignore this email.</p>
      </div>
    `,
  });
  return { sent: result.success, devCode: devSurface ? code : undefined };
}

export type CbtOtpVerifyResult = "ok" | "invalid" | "expired" | "locked" | "not_found";

/**
 * Verifies a submitted code. Consumes the OTP on success; increments attempts
 * on mismatch and invalidates after MAX_ATTEMPTS. Runs in a row-locked
 * transaction so concurrent guesses cannot race the attempt counter.
 */
export async function verifyCbtOtp(email: string, code: string): Promise<CbtOtpVerifyResult> {
  await ensureCbtSchema();
  const to = normalize(email);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{ code_hash: string; expires_at: string; attempts: number }>(
      "SELECT code_hash, expires_at, attempts FROM cbt.login_otps WHERE email = $1 FOR UPDATE",
      [to],
    );
    const row = res.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return "not_found";
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query("DELETE FROM cbt.login_otps WHERE email = $1", [to]);
      await client.query("COMMIT");
      return "expired";
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await client.query("DELETE FROM cbt.login_otps WHERE email = $1", [to]);
      await client.query("COMMIT");
      return "locked";
    }
    if (!hashesEqual(row.code_hash, hashCode(code))) {
      await client.query("UPDATE cbt.login_otps SET attempts = attempts + 1 WHERE email = $1", [to]);
      await client.query("COMMIT");
      return "invalid";
    }
    // Success — single-use: consume the OTP.
    await client.query("DELETE FROM cbt.login_otps WHERE email = $1", [to]);
    await client.query("COMMIT");
    return "ok";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
