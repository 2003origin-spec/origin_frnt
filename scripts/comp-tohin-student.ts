/**
 * Correctly comp the STUDENT-role row for tohin1400@gmail.com, and clean up the
 * stray comp that was applied to the teacher-role row.
 *
 * Accounts are keyed by (email, role) — there are two rows for this email:
 *   - role=teacher (user_teacher_tohin)  -> revert any admin_comp grants
 *   - role=student                       -> comp (4 admin_comp grants) + recompute
 *
 * Verifies the student row with the premium flag forced ON in THIS process only
 * (production env untouched).
 *
 * Usage:
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/comp-tohin-student.ts
 */

process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1"; // process-local, for verification only

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import {
  recomputeUserPremiumFlags,
  getEntitledSubjects,
  getStudentGate,
} from "@/server/entitlements";

const EMAIL = "tohin1400@gmail.com";

async function compRow(userId: string) {
  const p = getUserPostgresPool()!;
  const ins = await p.query(
    `INSERT INTO entitlements.subject_grants
       (id, user_id, subject, source, status, expires_at, created_at)
     SELECT 'grant_' || replace(gen_random_uuid()::text, '-', ''),
            $1, s.subject, 'admin_comp', 'active', NULL, NOW()
     FROM (VALUES ('physics'),('chemistry'),('mathematics'),('biology')) AS s(subject)
     WHERE NOT EXISTS (
       SELECT 1 FROM entitlements.subject_grants g
       WHERE g.user_id = $1 AND g.subject = s.subject
         AND g.source = 'admin_comp' AND g.status = 'active')
     RETURNING subject`,
    [userId],
  );
  await recomputeUserPremiumFlags(userId);
  return ins.rowCount ?? 0;
}

async function revertRow(userId: string) {
  const p = getUserPostgresPool()!;
  const del = await p.query(
    `UPDATE entitlements.subject_grants SET status = 'revoked', updated_at = NOW()
      WHERE user_id = $1 AND source = 'admin_comp' AND status = 'active' RETURNING subject`,
    [userId],
  );
  await recomputeUserPremiumFlags(userId);
  return del.rowCount ?? 0;
}

async function main() {
  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL not set.");
    process.exit(1);
  }
  await ensureSubjectGrantsSchema();
  const p = getUserPostgresPool()!;

  const rows = (
    await p.query<{ id: string; role: string; is_premium: boolean }>(
      "SELECT id, role, is_premium FROM origin_users WHERE lower(email) = lower($1) ORDER BY role",
      [EMAIL],
    )
  ).rows;
  console.log("rows for", EMAIL, ":");
  for (const r of rows) console.log(`  id=${r.id} role=${r.role} is_premium=${r.is_premium}`);

  const student = rows.find((r) => r.role === "student");
  const teacher = rows.find((r) => r.role === "teacher");

  if (teacher) {
    const reverted = await revertRow(teacher.id);
    console.log(`[teacher row ${teacher.id}] reverted ${reverted} stray admin_comp grant(s).`);
  }
  if (!student) {
    console.error("No student-role row found for this email — cannot comp the student account.");
    process.exit(1);
  }
  const comped = await compRow(student.id);
  console.log(`[student row ${student.id}] inserted ${comped} admin_comp grant(s) (idempotent).`);

  const after = await p.query<{ is_premium: boolean; premium_expiry: string | null }>(
    "SELECT is_premium, premium_expiry FROM origin_users WHERE id = $1",
    [student.id],
  );
  const entitled = await getEntitledSubjects(student.id);
  const gate = await getStudentGate(student.id, "student");
  console.log("---- STUDENT row verification (premium flag forced ON in-process) ----");
  console.log("is_premium:        ", after.rows[0]?.is_premium);
  console.log("premium_expiry:    ", after.rows[0]?.premium_expiry);
  console.log("entitledSubjects:  ", entitled);
  console.log("getStudentGate:    ", gate);

  await p.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[comp-tohin-student] failed", e);
  process.exit(1);
});
