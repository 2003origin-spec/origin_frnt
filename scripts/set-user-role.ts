/**
 * Reversible role flip for a single user (default tohin1400@gmail.com).
 *
 *   forward:  teacher -> student   (so the account experiences student premium gating)
 *   --revert: student -> teacher   (restore)
 *
 * Prints the before/after role. Touches exactly one origin_users row.
 *
 * Usage:
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/set-user-role.ts
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/set-user-role.ts --revert
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

const EMAIL = process.env.COMP_EMAIL || "tohin1400@gmail.com";
const REVERT = process.argv.includes("--revert");
const TARGET_ROLE = REVERT ? "teacher" : "student";

async function main() {
  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  const p = getUserPostgresPool()!;
  const before = await p.query<{ id: string; role: string }>(
    "SELECT id, role FROM origin_users WHERE lower(email) = lower($1)",
    [EMAIL],
  );
  const row = before.rows[0];
  if (!row) {
    console.error(`No origin_users row for ${EMAIL}.`);
    process.exit(1);
  }
  console.log(`${EMAIL}: id=${row.id} role(before)=${row.role}`);
  if (row.role === TARGET_ROLE) {
    console.log(`Already ${TARGET_ROLE}; nothing to change.`);
    await p.end();
    process.exit(0);
  }
  const upd = await p.query<{ role: string }>(
    "UPDATE origin_users SET role = $2 WHERE id = $1 RETURNING role",
    [row.id, TARGET_ROLE],
  );
  console.log(`role(after)=${upd.rows[0]?.role}`);
  await p.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[set-user-role] failed", e);
  process.exit(1);
});
