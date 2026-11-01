/**
 * Flow-1 grant teardown (Phase 14).
 *
 * A `teacher_code` grant is a free subject the student got BECAUSE they were
 * enrolled at a partner institute. It used to stay active for its whole
 * 1-year expiry whatever happened next — leave the institute, get suspended
 * for non-payment, or the institute itself gets terminated/suspended — because
 * the entitlement resolver never looks at enrollment or collaboration status.
 * These helpers are called from every one of those state transitions:
 *
 *   enrollment → left / suspended      (teacher PATCH; Flow-2 lapse reconcile;
 *                                       the paid-batch refund teardown on
 *                                       fix/refund-lifecycle, via
 *                                       revokeTeacherCodeGrantsForEnrollment)
 *   collaboration → terminated/rejected (admin)
 *   workspace → suspended / closed      (admin; account deletion; incidents)
 *
 * Each revokes the `teacher_code` rows only (paid grants, admin comps and
 * Razorpay subscriptions are untouched), then recomputes the is_premium /
 * premium_expiry mirror for the affected students and audits the change.
 *
 * Lives in its own module so the workspace/admin services can call it without
 * importing the whole student connect-service (and its import graph).
 */

import { recomputePremiumFlagsForUsers, recomputeUserPremiumFlags } from "@/server/entitlements";
import { recordAuditEvent } from "@/server/workspaces/audit";

import {
  revokeTeacherCodeGrantsForEnrollment as revokeTeacherCodeGrantRowsForEnrollment,
  revokeTeacherCodeGrantsForWorkspaces,
} from "./subject-grants-store";

export type GrantRevocationReason =
  | "enrollment_left"
  | "enrollment_suspended"
  | "enrollment_refunded"
  | "subscription_lapsed"
  | "collaboration_terminated"
  | "collaboration_rejected"
  | "workspace_suspended"
  | "workspace_closed";

/** Enrollment statuses that end a student's claim to the institute's free subject. */
export function enrollmentStatusRevokesGrants(status: string): status is "left" | "suspended" {
  return status === "left" || status === "suspended";
}

/**
 * Revokes the student's free subject(s) at one institute. Returns how many
 * grants were revoked (0 = nothing to do, no recompute/audit performed).
 */
export async function revokeConnectGrantsForEnrollment(input: {
  studentId: string;
  workspaceId: string;
  actorUserId: string | null;
  reason: GrantRevocationReason;
  requestId?: string | null;
}): Promise<number> {
  const revoked = await revokeTeacherCodeGrantRowsForEnrollment({
    userId: input.studentId,
    workspaceId: input.workspaceId,
  });
  if (revoked.length === 0) return 0;

  await recomputeUserPremiumFlags(input.studentId);

  for (const grant of revoked) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "subject_grant",
      entityId: grant.id,
      action: "subject_grant.revoked",
      before: grant,
      after: { ...grant, status: "revoked", reason: input.reason },
      requestId: input.requestId,
    });
  }
  return revoked.length;
}

/**
 * The one call for "this enrolment's status just changed": when the new
 * status ends the student's claim (`left` / `suspended`) it revokes the
 * institute's free `teacher_code` subject, otherwise it does nothing. Call it
 * from EVERY path that moves an enrolment to `left` — the teacher PATCH, and
 * the paid-batch refund teardown (pass `reason: "enrollment_refunded"`).
 * Idempotent: a second call finds no active `teacher_code` row and returns 0,
 * so a re-run teardown can call it again safely. Returns grants revoked.
 */
export async function revokeTeacherCodeGrantsForEnrollment(input: {
  studentId: string;
  workspaceId: string;
  /** The enrolment's status AFTER the change. */
  status: string;
  actorUserId: string | null;
  /** Defaults to enrollment_left / enrollment_suspended from `status`. */
  reason?: GrantRevocationReason;
  requestId?: string | null;
}): Promise<number> {
  if (!enrollmentStatusRevokesGrants(input.status)) return 0;
  return revokeConnectGrantsForEnrollment({
    studentId: input.studentId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    reason: input.reason ?? (input.status === "left" ? "enrollment_left" : "enrollment_suspended"),
    requestId: input.requestId,
  });
}

/**
 * Revokes every free subject issued through these institutes (one UPDATE),
 * recomputes the mirror for every affected student in bulk, and writes one
 * summary audit row per institute. Returns how many grants were revoked.
 */
export async function revokeConnectGrantsForWorkspaces(input: {
  workspaceIds: string[];
  actorUserId: string | null;
  reason: GrantRevocationReason;
  requestId?: string | null;
}): Promise<number> {
  const revoked = await revokeTeacherCodeGrantsForWorkspaces(input.workspaceIds);
  if (revoked.length === 0) return 0;

  await recomputePremiumFlagsForUsers(revoked.map((r) => r.userId));

  const byWorkspace = new Map<string, Set<string>>();
  for (const row of revoked) {
    const users = byWorkspace.get(row.workspaceId) ?? new Set<string>();
    users.add(row.userId);
    byWorkspace.set(row.workspaceId, users);
  }
  for (const [workspaceId, users] of byWorkspace) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId,
      entityType: "teacher_workspace",
      entityId: workspaceId,
      action: "subject_grants.bulk_revoked",
      after: {
        reason: input.reason,
        grantsRevoked: revoked.filter((r) => r.workspaceId === workspaceId).length,
        studentsAffected: users.size,
      },
      requestId: input.requestId,
    });
  }
  return revoked.length;
}
