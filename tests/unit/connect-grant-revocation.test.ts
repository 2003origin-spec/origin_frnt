/**
 * Flow-1 `teacher_code` grants are revoked when the reason for them goes away.
 *
 * They used to stay live for their full 1-year expiry after the student left,
 * was suspended for non-payment, or the institute was terminated/suspended —
 * revokeConnectSubject had zero callers. These tests pin every wired
 * transition: the revoke UPDATE runs (teacher_code rows only), the premium
 * mirror is recomputed for the affected students, and an audit row is written.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules, userPostgresStub } from "./_module-stubs";

const pool = createFakePool();
const recomputedOne: string[] = [];
const recomputedMany: string[][] = [];
const audits: { action: string; after?: unknown; workspaceId: string | null }[] = [];

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "subject-grants-schema": {
    ensureSubjectGrantsSchema: async () => undefined,
    TEACHER_CODE_UNIQUE_INDEX: "uq_subject_grants_one_teacher_code",
  },
  "collaboration-schema": { ensureCollaborationSchema: async () => undefined },
  "@/server/entitlements": {
    recomputeUserPremiumFlags: async (id: string) => {
      recomputedOne.push(id);
    },
    recomputePremiumFlagsForUsers: async (ids: string[]) => {
      recomputedMany.push([...new Set(ids)].sort());
    },
  },
  "workspaces/audit": {
    recordAuditEvent: async (e: { action: string; after?: unknown; workspaceId: string | null }) => {
      audits.push(e);
    },
  },
  "./audit": {
    recordAuditEvent: async (e: { action: string; after?: unknown; workspaceId: string | null }) => {
      audits.push(e);
    },
  },
});

/* eslint-disable @typescript-eslint/no-require-imports */
const revocation = require("@/server/connect/grant-revocation") as typeof import("@/server/connect/grant-revocation");
const collaboration = require("@/server/connect/collaboration-service") as typeof import("@/server/connect/collaboration-service");
const adminService = require("@/server/workspaces/admin-service") as typeof import("@/server/workspaces/admin-service");
/* eslint-enable @typescript-eslint/no-require-imports */

const REVOKE_ONE = "WHERE user_id = $1 AND workspace_id = $2";
const REVOKE_WS = "WHERE workspace_id = ANY($1::text[])";
const NOW = new Date().toISOString();

function grantRow(id: string, userId: string, workspaceId: string, subject = "physics") {
  return {
    id,
    user_id: userId,
    subject,
    source: "teacher_code",
    workspace_id: workspaceId,
    enrollment_id: null,
    order_id: null,
    status: "revoked",
    expires_at: null,
    granted_by: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function reset() {
  pool.reset();
  recomputedOne.length = 0;
  recomputedMany.length = 0;
  audits.length = 0;
}

test("enrollment revoke: teacher_code rows only, recompute + audit with the reason", async () => {
  reset();
  pool.handler = (sql) =>
    sql.includes("UPDATE entitlements.subject_grants") ? { rows: [grantRow("g1", "stu_1", "ws_1")] } : undefined;

  const n = await revocation.revokeConnectGrantsForEnrollment({
    studentId: "stu_1",
    workspaceId: "ws_1",
    actorUserId: "teacher_1",
    reason: "enrollment_left",
  });

  assert.equal(n, 1);
  const [update] = pool.matching("UPDATE entitlements.subject_grants");
  assert.ok(update.sql.includes(REVOKE_ONE));
  assert.ok(update.sql.includes("source = 'teacher_code'"));
  assert.deepEqual(update.params, ["stu_1", "ws_1"]);
  assert.deepEqual(recomputedOne, ["stu_1"]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "subject_grant.revoked");
  assert.equal((audits[0].after as { reason: string }).reason, "enrollment_left");
});

test("enrollment revoke with nothing to revoke skips recompute and audit", async () => {
  reset();
  const n = await revocation.revokeConnectGrantsForEnrollment({
    studentId: "stu_1",
    workspaceId: "ws_1",
    actorUserId: null,
    reason: "subscription_lapsed",
  });
  assert.equal(n, 0);
  assert.deepEqual(recomputedOne, []);
  assert.equal(audits.length, 0);
});

test("revokeTeacherCodeGrantsForEnrollment: revokes on left/suspended only, reason defaults from status", async () => {
  reset();
  pool.handler = (sql) =>
    sql.includes("UPDATE entitlements.subject_grants") ? { rows: [grantRow("g1", "stu_1", "ws_1")] } : undefined;

  for (const status of ["active", "unassigned"]) {
    const n = await revocation.revokeTeacherCodeGrantsForEnrollment({
      studentId: "stu_1",
      workspaceId: "ws_1",
      status,
      actorUserId: "teacher_1",
    });
    assert.equal(n, 0, status);
  }
  assert.equal(pool.matching("UPDATE entitlements.subject_grants").length, 0);

  assert.equal(
    await revocation.revokeTeacherCodeGrantsForEnrollment({
      studentId: "stu_1",
      workspaceId: "ws_1",
      status: "left",
      actorUserId: "teacher_1",
    }),
    1,
  );
  assert.equal((audits[0].after as { reason: string }).reason, "enrollment_left");

  // the refund teardown passes its own reason
  await revocation.revokeTeacherCodeGrantsForEnrollment({
    studentId: "stu_1",
    workspaceId: "ws_1",
    status: "left",
    actorUserId: null,
    reason: "enrollment_refunded",
  });
  assert.equal((audits[1].after as { reason: string }).reason, "enrollment_refunded");
});

test("workspace revoke: one UPDATE, bulk recompute of distinct students, one audit per institute", async () => {
  reset();
  pool.handler = (sql) =>
    sql.includes("UPDATE entitlements.subject_grants")
      ? {
          rows: [
            { user_id: "stu_1", workspace_id: "ws_1" },
            { user_id: "stu_2", workspace_id: "ws_1" },
            { user_id: "stu_1", workspace_id: "ws_2" },
          ],
        }
      : undefined;

  const n = await revocation.revokeConnectGrantsForWorkspaces({
    workspaceIds: ["ws_1", "ws_2", "ws_1"],
    actorUserId: "admin_1",
    reason: "workspace_suspended",
  });

  assert.equal(n, 3);
  const updates = pool.matching("UPDATE entitlements.subject_grants");
  assert.equal(updates.length, 1);
  assert.ok(updates[0].sql.includes(REVOKE_WS));
  assert.ok(updates[0].sql.includes("source = 'teacher_code'"));
  assert.deepEqual(updates[0].params, [["ws_1", "ws_2"]]);
  assert.deepEqual(recomputedMany, [["stu_1", "stu_2"]]);
  assert.deepEqual(
    audits.map((a) => [a.workspaceId, a.action]),
    [
      ["ws_1", "subject_grants.bulk_revoked"],
      ["ws_2", "subject_grants.bulk_revoked"],
    ],
  );
});

test("enrollmentStatusRevokesGrants: only left and suspended", () => {
  assert.equal(revocation.enrollmentStatusRevokesGrants("left"), true);
  assert.equal(revocation.enrollmentStatusRevokesGrants("suspended"), true);
  assert.equal(revocation.enrollmentStatusRevokesGrants("active"), false);
  assert.equal(revocation.enrollmentStatusRevokesGrants("unassigned"), false);
});

// ── Wiring: each state transition calls the revoke ──────────────────────────

function collaborationRow(status: string) {
  return {
    id: "collab_1",
    workspace_id: "ws_9",
    status,
    commission_bps: 0,
    razorpay_route_account_id: null,
    flow1_enabled: true,
    flow2_enabled: true,
    requested_by: "t",
    approved_by: null,
    approved_at: null,
    metadata: {},
    created_at: NOW,
    updated_at: NOW,
  };
}

for (const [status, expectRevoke] of [
  ["terminated", true],
  ["rejected", true],
  ["paused", false],
  ["active", false],
] as const) {
  test(`collaboration → ${status} ${expectRevoke ? "revokes" : "keeps"} the institute's free grants`, async () => {
    reset();
    pool.handler = (sql) => {
      if (sql.includes("FROM app.origin_collaborations WHERE workspace_id")) return { rows: [collaborationRow("active")] };
      if (sql.includes("UPDATE app.origin_collaborations")) return { rows: [collaborationRow(status)] };
      if (sql.includes("UPDATE entitlements.subject_grants")) return { rows: [{ user_id: "stu_1", workspace_id: "ws_9" }] };
      return undefined;
    };
    await collaboration.setCollaborationStatusService({ workspaceId: "ws_9", status, adminUserId: "admin_1" });
    const revoked = pool.matching(REVOKE_WS);
    assert.equal(revoked.length, expectRevoke ? 1 : 0);
    if (expectRevoke) {
      assert.deepEqual(revoked[0].params, [["ws_9"]]);
      assert.deepEqual(recomputedMany, [["stu_1"]]);
    }
  });
}

function workspaceRow(status: string) {
  return {
    id: "ws_7",
    workspace_type: "institute",
    owner_user_id: "owner_1",
    display_name: "Inst",
    country: "IN",
    status,
    verification_status: "unverified",
    created_at: NOW,
    updated_at: NOW,
  };
}

for (const action of ["suspend", "close"] as const) {
  test(`admin ${action} workspace revokes its free grants`, async () => {
    reset();
    pool.handler = (sql) => {
      if (sql.includes("SELECT * FROM app.teacher_workspaces WHERE id")) return { rows: [workspaceRow("active")] };
      if (sql.includes("UPDATE app.teacher_workspaces")) return { rows: [{ id: "ws_7" }] };
      if (sql.includes("UPDATE entitlements.subject_grants")) return { rows: [{ user_id: "stu_5", workspace_id: "ws_7" }] };
      return undefined;
    };
    if (action === "suspend") {
      await adminService.suspendWorkspaceService({ workspaceId: "ws_7", reason: "policy_violation" as never, adminUserId: "admin_1" });
    } else {
      await adminService.closeWorkspaceService({ workspaceId: "ws_7", adminUserId: "admin_1" });
    }
    const revoked = pool.matching(REVOKE_WS);
    assert.equal(revoked.length, 1);
    assert.deepEqual(revoked[0].params, [["ws_7"]]);
    assert.deepEqual(recomputedMany, [["stu_5"]]);
  });
}

test("teacher PATCH, Flow-2 lapse reconcile and account deletion call the revoke", () => {
  const read = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
  const patch = read("app/api/teacher/workspaces/[workspaceId]/students/[studentId]/route.ts");
  assert.match(patch, /revokeTeacherCodeGrantsForEnrollment\(\{[^}]*status: updated\.status/);

  const reconcile = read("server/connect/enrollment-subscription-service.ts");
  const lapse = reconcile.slice(reconcile.indexOf("export async function reconcileEnrollmentSubscriptions"));
  assert.ok(
    lapse.indexOf("revokeConnectGrantsForEnrollment(") > lapse.indexOf('setEnrollmentStatus(sub.workspaceId, sub.studentId, "suspended")'),
  );
  assert.ok(lapse.indexOf("revokeConnectGrantsForEnrollment(") < lapse.indexOf("markEnrollmentSubscriptionExpired("));
  assert.match(lapse, /reason: "subscription_lapsed"/);

  const lifecycle = read("server/admin/user-lifecycle-service.ts");
  assert.match(lifecycle, /revokeConnectGrantsForWorkspaces\(\{\s*workspaceIds: suspendedIds/);
});
