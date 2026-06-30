/**
 * One-time admin setup (run against prod Neon, then it's idempotent):
 *
 *   1. Creates the MAIN admin account for MAIN_ADMIN_EMAIL with role='admin'.
 *      Admin login is OTP-based (handleLoginWithOtp finds the user by email+role,
 *      no password check), so password_hash is unused — but it's NOT NULL, so we
 *      copy it from the same person's existing teacher account.
 *   2. Removes every OTHER role='admin' account (legacy admin@origin.com), so the
 *      only platform admin is MAIN_ADMIN_EMAIL. Falls back to demoting (role →
 *      'student') if a hard delete is blocked by a foreign-key reference.
 *
 * Run:
 *   cd new-frontend
 *   node --env-file=/Users/xyx/Projects/Origin/.env scripts/seed-main-admin.mjs
 *
 * Safe to re-run. Reads USER_DATABASE_URL.
 */

import { Client } from "pg";

const MAIN_ADMIN_EMAIL = (process.env.MAIN_ADMIN_EMAIL || "tohin1400@gmail.com").toLowerCase();
const MAIN_ADMIN_NAME = process.env.MAIN_ADMIN_NAME || "Tohin Admin";
const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID || "user_admin_main";

const connectionString = process.env.USER_DATABASE_URL;
if (!connectionString) {
  console.error("USER_DATABASE_URL is not set. Run with --env-file=/Users/xyx/Projects/Origin/.env");
  process.exit(1);
}

const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();

  // 0. Ensure the admin-tier column exists (mirrors the app's runtime-ensure).
  await c.query(`ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS is_main_admin BOOLEAN NOT NULL DEFAULT FALSE`);

  // 1. Source a NOT-NULL-satisfying password_hash from any existing account for
  //    this email (teacher first, then student), since admin login won't use it.
  const src = await c.query(
    `SELECT password_hash, name FROM origin_users
      WHERE LOWER(email) = $1 AND role IN ('teacher','student')
      ORDER BY (role = 'teacher') DESC LIMIT 1`,
    [MAIN_ADMIN_EMAIL],
  );
  const passwordHash = src.rows[0]?.password_hash ?? "otp-only-no-password";

  await c.query(
    `INSERT INTO origin_users (id, name, email, password_hash, role, is_onboarded, is_main_admin)
     VALUES ($1, $2, $3, $4, 'admin', true, true)
     ON CONFLICT (email, role) DO UPDATE SET is_onboarded = true, is_main_admin = true`,
    [MAIN_ADMIN_ID, MAIN_ADMIN_NAME, MAIN_ADMIN_EMAIL, passwordHash],
  );
  console.log(`✓ main admin ensured (is_main_admin=true): ${MAIN_ADMIN_EMAIL}`);

  // 2. Exactly one MAIN admin: clear the flag on every other admin. Sub-admins are
  //    now a supported tier, so they are PRESERVED (not deleted) — the main admin
  //    removes unwanted ones from /admin/admins.
  const cleared = await c.query(
    `UPDATE origin_users SET is_main_admin = FALSE
      WHERE role = 'admin' AND LOWER(email) <> $1 AND is_main_admin = TRUE`,
    [MAIN_ADMIN_EMAIL],
  );
  console.log(`✓ cleared main-admin flag on ${cleared.rowCount} other admin(s); sub-admins preserved.`);

  const final = await c.query("SELECT id, name, email, role, is_main_admin FROM origin_users WHERE role = 'admin'");
  console.log("Final admins:", JSON.stringify(final.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
