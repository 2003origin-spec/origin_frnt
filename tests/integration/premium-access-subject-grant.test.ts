/**
 * DB-backed round-trip for the per-subject "Manage subjects" admin control.
 * Verifies the invariants it rests on:
 *   1. grantAdminCompSubjectsToUser/revokeAdminCompSubjectsForUser only ever
 *      touch the exact subjects given — a student's other subjects (owned via
 *      any source) are untouched.
 *   2. updateStudentSubjectComp (the "set desired state" orchestration used by
 *      the API route) computes the correct grant/revoke diff against the
 *      student's CURRENT admin_comp subjects and is a no-op when nothing changed.
 *   3. getStudentSubjectAccess correctly attributes paid vs teacher_code vs
 *      admin_comp per subject, so the modal never lets an admin revoke a real
 *      subscription or a teacher's grant.
 * Skips when USER_DATABASE_URL is not configured (safe on a bare dev box).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, rawPool, makeId } from "./_db";
import { ensureUserSchema } from "@/server/db-users";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import {
  grantAdminCompSubjectsToUser,
  revokeAdminCompSubjectsForUser,
} from "@/server/connect/subject-grants-store";
import { getStudentSubjectAccess } from "@/server/premium-access-admin-store";
import { updateStudentSubjectComp } from "@/server/premium-access-admin-service";
import { recomputePremiumFlagsForUsers } from "@/server/entitlements";

const maybe = dbConfigured() ? test : test.skip;

async function seedStudent(): Promise<string> {
  const id = makeId("user_subj");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
     VALUES ($1, 'Subject Test', $2, 'student', 'test-no-login') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return id;
}

/** granted_by and audit actor_user_id both FK to origin_users — seed a real one. */
async function seedAdmin(): Promise<string> {
  const id = makeId("user_admin");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
     VALUES ($1, 'Admin Test', $2, 'admin', 'test-no-login') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@example.com`],
  );
  return id;
}

/** subject_grants.workspace_id FKs to app.teacher_workspaces — seed a minimal real one. */
async function seedWorkspace(ownerUserId: string): Promise<string> {
  const id = makeId("ws_subj");
  await rawPool().query(
    `INSERT INTO app.teacher_workspaces (id, workspace_type, owner_user_id, display_name)
     VALUES ($1, 'institute', $2, 'Subject Test Workspace') ON CONFLICT (id) DO NOTHING`,
    [id, ownerUserId],
  );
  return id;
}

async function activeCompSubjects(id: string): Promise<string[]> {
  const r = await rawPool().query<{ subject: string }>(
    `SELECT subject FROM entitlements.subject_grants
      WHERE user_id = $1 AND source = 'admin_comp' AND status = 'active'
      ORDER BY subject`,
    [id],
  );
  return r.rows.map((row) => row.subject);
}

maybe("grantAdminCompSubjectsToUser/revokeAdminCompSubjectsForUser touch only the given subjects", async () => {
  await ensureUserSchema();
  const u = await seedStudent();
  try {
    const g1 = await grantAdminCompSubjectsToUser({ userId: u, subjects: ["physics", "chemistry"], grantedBy: null });
    assert.equal(g1.rowsInserted, 2);
    assert.deepEqual(await activeCompSubjects(u), ["chemistry", "physics"]);

    // Re-granting an already-comped subject alongside a new one only inserts the new one.
    const g2 = await grantAdminCompSubjectsToUser({ userId: u, subjects: ["physics", "biology"], grantedBy: null });
    assert.equal(g2.rowsInserted, 1, "physics already active, skipped by the idempotency guard");
    assert.deepEqual(await activeCompSubjects(u), ["biology", "chemistry", "physics"]);

    const rv = await revokeAdminCompSubjectsForUser({ userId: u, subjects: ["chemistry"] });
    assert.equal(rv.rowsRevoked, 1);
    assert.deepEqual(await activeCompSubjects(u), ["biology", "physics"], "only chemistry revoked");
  } finally {
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [u]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [u]);
  }
});

maybe("updateStudentSubjectComp diffs against current state and no-ops when unchanged", async () => {
  await ensureUserSchema();
  const u = await seedStudent();
  const admin = await seedAdmin();
  try {
    const first = await updateStudentSubjectComp({
      actorUserId: admin,
      userId: u,
      subjects: ["physics", "mathematics"],
    });
    assert.deepEqual(first.granted.slice().sort(), ["mathematics", "physics"]);
    assert.deepEqual(first.revoked, []);
    assert.deepEqual(await activeCompSubjects(u), ["mathematics", "physics"]);

    // Same desired set again → no-op, no rows touched.
    const second = await updateStudentSubjectComp({
      actorUserId: admin,
      userId: u,
      subjects: ["physics", "mathematics"],
    });
    assert.deepEqual(second.granted, []);
    assert.deepEqual(second.revoked, []);

    // Swap mathematics for biology → one grant, one revoke, physics untouched.
    const third = await updateStudentSubjectComp({
      actorUserId: admin,
      userId: u,
      subjects: ["physics", "biology"],
    });
    assert.deepEqual(third.granted, ["biology"]);
    assert.deepEqual(third.revoked, ["mathematics"]);
    assert.deepEqual(await activeCompSubjects(u), ["biology", "physics"]);
  } finally {
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [u]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[u, admin]]);
  }
});

maybe("getStudentSubjectAccess attributes paid/teacher/comp correctly and never conflates them", async () => {
  await ensureUserSchema();
  await ensureSubscriptionsSchema();
  const u = await seedStudent();
  const admin = await seedAdmin();
  const workspaceId = await seedWorkspace(admin);
  try {
    // physics: paid subscription. chemistry: teacher_code grant. mathematics: admin_comp. biology: nothing.
    await rawPool().query(
      `INSERT INTO subscriptions.user_subscriptions (id, user_id, subject, status)
       VALUES ($1, $2, 'physics', 'active')`,
      [makeId("sub"), u],
    );
    await rawPool().query(
      `INSERT INTO entitlements.subject_grants (id, user_id, subject, source, workspace_id, status)
       VALUES ($1, $2, 'chemistry', 'teacher_code', $3, 'active')`,
      [makeId("grant"), u, workspaceId],
    );
    await grantAdminCompSubjectsToUser({ userId: u, subjects: ["mathematics"], grantedBy: null });

    const rows = await getStudentSubjectAccess(u);
    const bySubject = Object.fromEntries(rows.map((r) => [r.subject, r]));

    assert.equal(bySubject.physics.paid, true);
    assert.equal(bySubject.physics.comp, false);
    assert.equal(bySubject.chemistry.teacherWorkspaceId, workspaceId);
    assert.equal(bySubject.chemistry.paid, false);
    assert.equal(bySubject.mathematics.comp, true);
    assert.equal(bySubject.mathematics.paid, false);
    assert.equal(bySubject.mathematics.teacherWorkspaceId, null);
    assert.equal(bySubject.biology.paid, false);
    assert.equal(bySubject.biology.comp, false);
    assert.equal(bySubject.biology.teacherWorkspaceId, null);

    // Setting desired subjects to just "mathematics" (already comp'd) must not
    // touch the paid or teacher_code rows even though they're excluded from the list.
    await updateStudentSubjectComp({ actorUserId: admin, userId: u, subjects: ["mathematics"] });
    await recomputePremiumFlagsForUsers([u]);
    const after = await getStudentSubjectAccess(u);
    const afterBySubject = Object.fromEntries(after.map((r) => [r.subject, r]));
    assert.equal(afterBySubject.physics.paid, true, "paid subscription untouched");
    assert.equal(afterBySubject.chemistry.teacherWorkspaceId, workspaceId, "teacher grant untouched");
  } finally {
    await rawPool().query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = $1`, [u]);
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [u]);
    await rawPool().query(`DELETE FROM app.teacher_workspaces WHERE id = $1`, [workspaceId]);
    await rawPool().query(`DELETE FROM origin_users WHERE id = ANY($1)`, [[u, admin]]);
  }
});
