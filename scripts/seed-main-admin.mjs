/**
 * One-time admin setup (run against prod Neon, then it's idempotent):
 *
 *   1. Creates every MAIN admin account configured in the comma-separated
 *      PLATFORM_MAIN_ADMIN_EMAIL (or MAIN_ADMIN_EMAIL) allowlist.
 *      Admin login is OTP-based (handleLoginWithOtp finds the user by email+role,
 *      no password check), so password_hash is unused — but it's NOT NULL, so we
 *      copy it from the same person's existing teacher/student account.
 *   2. Clears `is_main_admin` on every admin outside the allowlist. Other admin
 *      accounts remain available as sub-admins.
 *
 * Run:
 *   cd new-frontend
 *   PLATFORM_MAIN_ADMIN_EMAIL=adminoffice@o3origin.com,2003origin@gmail.com \
 *     node --env-file=/Users/xyx/Projects/Origin/.env scripts/seed-main-admin.mjs
 *
 * Safe to re-run. Reads USER_DATABASE_URL.
 */

import { randomUUID } from "node:crypto";

import { Client } from "pg";

const DEFAULT_MAIN_ADMIN_EMAILS = [
  "adminoffice@o3origin.com",
  "2003origin@gmail.com",
];

function parseMainAdminEmails(value) {
  const emails = (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails.length > 0 ? emails : DEFAULT_MAIN_ADMIN_EMAILS)];
}

const MAIN_ADMIN_EMAILS = parseMainAdminEmails(
  process.env.PLATFORM_MAIN_ADMIN_EMAIL || process.env.MAIN_ADMIN_EMAIL,
);

function adminName(email) {
  if (process.env.MAIN_ADMIN_NAME) return process.env.MAIN_ADMIN_NAME;
  if (email === "adminoffice@o3origin.com") return "Origin Admin Office";
  if (email === "2003origin@gmail.com") return "Origin Admin";
  return "Origin Main Admin";
}

const connectionString = process.env.USER_DATABASE_URL;
if (!connectionString) {
  console.error("USER_DATABASE_URL is not set. Run with --env-file=/Users/xyx/Projects/Origin/.env");
  process.exit(1);
}

const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  try {
    await c.query("BEGIN");

    // 0. Ensure the admin-tier column exists (mirrors the app's runtime-ensure).
    await c.query(`ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS is_main_admin BOOLEAN NOT NULL DEFAULT FALSE`);

    // 1. Ensure every configured email has an OTP-login admin row.
    for (const email of MAIN_ADMIN_EMAILS) {
      const src = await c.query(
        `SELECT password_hash FROM origin_users
          WHERE LOWER(email) = $1 AND role IN ('teacher','student')
          ORDER BY (role = 'teacher') DESC LIMIT 1`,
        [email],
      );
      const passwordHash = src.rows[0]?.password_hash ?? "otp-only-no-password";
      const id = `user_admin_${randomUUID()}`;

      await c.query(
        `INSERT INTO origin_users (id, name, email, password_hash, role, is_onboarded, is_main_admin)
         VALUES ($1, $2, $3, $4, 'admin', true, true)
         ON CONFLICT (email, role) DO UPDATE
           SET is_onboarded = true, is_main_admin = true`,
        [id, adminName(email), email, passwordHash],
      );
      console.log(`✓ main admin ensured (is_main_admin=true): ${email}`);
    }

    // 2. Preserve all other admins as sub-admins, including the former default.
    const cleared = await c.query(
      `UPDATE origin_users SET is_main_admin = FALSE
        WHERE role = 'admin'
          AND NOT (LOWER(email) = ANY($1::text[]))
          AND is_main_admin = TRUE`,
      [MAIN_ADMIN_EMAILS],
    );
    console.log(`✓ cleared main-admin flag on ${cleared.rowCount} other admin(s); sub-admins preserved.`);

    const final = await c.query(
      `SELECT id, name, email, role, is_main_admin
         FROM origin_users
        WHERE role = 'admin'
        ORDER BY is_main_admin DESC, email ASC`,
    );
    console.log("Final admins:", JSON.stringify(final.rows, null, 2));

    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
