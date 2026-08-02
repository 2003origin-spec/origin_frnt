/**
 * Targeted comp + verification for a single user (default tohin1400@gmail.com).
 *
 * SAFE / REVERSIBLE. Unlike scripts/backfill-phase14-premium-grants.ts (which
 * touches every is_premium user), this only:
 *   1. inserts 4 active `admin_comp` subject grants for ONE user (idempotent), then
 *   2. recomputes that user's is_premium / premium_expiry mirror, then
 *   3. with the premium flag forced ON *in this process only*, prints the resolved
 *      entitledSubjects + student gate so you can confirm the pipeline works.
 *
 * It does NOT change any Vercel/production feature flag, so production gating
 * stays off and no other user is affected.
 *
 * Usage:
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/comp-tohin1400.ts
 *
 * Revert (remove the comp):
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/comp-tohin1400.ts --revert
 */

// Force the read-path flag ON for THIS process only (verification step). This is
// process-local and never written anywhere — production env is untouched.
process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import {
  recomputeUserPremiumFlags,
  getEntitledSubjects,
  getStudentGate,
} from "@/server/entitlements";

const EMAIL = process.env.COMP_EMAIL || "tohin1400@gmail.com";
const REVERT = process.argv.includes("--revert");
const SUBJECTS = ["physics", "chemistry", "mathematics", "biology"] as const;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function main() {
  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  await ensureSubjectGrantsSchema();
  const p = pool();

  const found = await p.query<{ id: string; role: string; is_premium: boolean }>(
    "SELECT id, role, is_premium FROM origin_users WHERE lower(email) = lower($1)",
    [EMAIL],
  );
  const user = found.rows[0];
  if (!user) {
    console.error(`No origin_users row for ${EMAIL}. Nothing to do.`);
    process.exit(1);
  }
  console.log(`User ${EMAIL}: id=${user.id} role=${user.role} is_premium(before)=${user.is_premium}`);

  if (REVERT) {
    const del = await p.query(
      `UPDATE entitlements.subject_grants SET status = 'revoked', updated_at = NOW()
        WHERE user_id = $1 AND source = 'admin_comp' AND status = 'active' RETURNING subject`,
      [user.id],
    );
    await recomputeUserPremiumFlags(user.id);
    console.log(`[revert] revoked ${del.rowCount} admin_comp grant(s).`);
  } else {
    const ins = await p.query<{ subject: string }>(
      `INSERT INTO entitlements.subject_grants
         (id, user_id, subject, source, status, expires_at, created_at)
       SELECT 'grant_' || replace(gen_random_uuid()::text, '-', ''),
              $1, s.subject, 'admin_comp', 'active', NULL, NOW()
       FROM (VALUES ('physics'),('chemistry'),('mathematics'),('biology')) AS s(subject)
       WHERE NOT EXISTS (
         SELECT 1 FROM entitlements.subject_grants g
         WHERE g.user_id = $1 AND g.subject = s.subject
           AND g.source = 'admin_comp' AND g.status = 'active'
       )
       RETURNING subject`,
      [user.id],
    );
    await recomputeUserPremiumFlags(user.id);
    console.log(`[comp] inserted ${ins.rowCount} new admin_comp grant(s) (idempotent).`);
  }

  // ---- Verification (flag ON in-process) ----
  const after = await p.query<{ is_premium: boolean; premium_expiry: string | null }>(
    "SELECT is_premium, premium_expiry FROM origin_users WHERE id = $1",
    [user.id],
  );
  const entitled = await getEntitledSubjects(user.id);
  const gate = await getStudentGate(user.id, "student");
  console.log("---- verification (premium flag forced ON for this process) ----");
  console.log("is_premium (after):  ", after.rows[0]?.is_premium);
  console.log("premium_expiry:      ", after.rows[0]?.premium_expiry);
  console.log("entitledSubjects:    ", entitled);
  console.log("getStudentGate:      ", gate);
  console.log("expected when comped: is_premium=true, entitledSubjects=4, gate.enforced=true, anyPremium=true");

  await p.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[comp-tohin1400] failed", e);
  process.exit(1);
});
