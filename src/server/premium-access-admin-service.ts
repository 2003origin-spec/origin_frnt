/**
 * Orchestration for the /admin/premium-access console. Ties the set-based
 * subject-grants DML to the is_premium mirror recompute and the admin audit log.
 *
 * Contract each mutating op honours:
 *   1. one set-based store call (grant/revoke) → the affected user ids
 *   2. recomputePremiumFlagsForUsers(ids)      → keep is_premium/premium_expiry true
 *   3. one recordAuditEvent                     → who did what, to how many
 *
 * Paid Razorpay premium (subscriptions.user_subscriptions) is never touched — the
 * store only ever writes source='admin_comp' grant rows.
 */

import {
  grantAdminCompToUsers,
  grantAdminCompToAllFreeStudents,
  revokeAdminCompForUsers,
  revokeAllAdminComp,
  expireLapsedSubjectGrants,
  grantAdminCompSubjectsToUser,
  revokeAdminCompSubjectsForUser,
} from "@/server/connect/subject-grants-store";
import { recomputePremiumFlagsForUsers } from "@/server/entitlements";
import { recordAuditEvent } from "@/server/workspaces/audit";
import {
  getPremiumPlanCounts,
  getStudentSubjectAccess as getStudentSubjectAccessStore,
  type PremiumPlanCounts,
  type SubjectAccessRow,
} from "@/server/premium-access-admin-store";
import { getEventMode, setEventMode, type EventMode } from "@/server/premium-access-schema";
import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

export type PremiumAccessOverview = {
  counts: PremiumPlanCounts;
  eventMode: EventMode;
};

export async function getPremiumAccessOverview(): Promise<PremiumAccessOverview> {
  const [counts, eventMode] = await Promise.all([getPremiumPlanCounts(), getEventMode()]);
  return { counts, eventMode };
}

function auditEntityId(mode: string, userIds?: string[]): string {
  if (mode !== "users") return mode;
  return userIds && userIds.length === 1 ? userIds[0] : "bulk";
}

export async function grantPremiumComp(input: {
  actorUserId: string;
  mode: "users" | "all_free";
  userIds?: string[];
  query?: string;
  expiresAt?: string | null;
  requestId?: string | null;
}): Promise<{ usersAffected: number; rowsInserted: number }> {
  const result =
    input.mode === "all_free"
      ? await grantAdminCompToAllFreeStudents({
          grantedBy: input.actorUserId,
          expiresAt: input.expiresAt ?? null,
          query: input.query,
        })
      : await grantAdminCompToUsers({
          userIds: input.userIds ?? [],
          grantedBy: input.actorUserId,
          expiresAt: input.expiresAt ?? null,
        });

  await recomputePremiumFlagsForUsers(result.userIds);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "premium_comp",
    entityId: auditEntityId(input.mode, input.userIds),
    action: "premium.comp_granted",
    after: {
      mode: input.mode,
      usersAffected: result.userIds.length,
      rowsInserted: result.rowsInserted,
      expiresAt: input.expiresAt ?? null,
      query: input.query ?? null,
      userIds: result.userIds.slice(0, 100),
    },
    requestId: input.requestId ?? null,
  });

  return { usersAffected: result.userIds.length, rowsInserted: result.rowsInserted };
}

export async function revokePremiumComp(input: {
  actorUserId: string;
  mode: "users" | "all_comp";
  userIds?: string[];
  query?: string;
  requestId?: string | null;
}): Promise<{ usersAffected: number }> {
  const result =
    input.mode === "all_comp"
      ? await revokeAllAdminComp(input.query)
      : await revokeAdminCompForUsers(input.userIds ?? []);

  await recomputePremiumFlagsForUsers(result.userIds);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "premium_comp",
    entityId: auditEntityId(input.mode, input.userIds),
    action: "premium.comp_revoked",
    after: {
      mode: input.mode,
      usersAffected: result.userIds.length,
      query: input.query ?? null,
      userIds: result.userIds.slice(0, 100),
    },
    requestId: input.requestId ?? null,
  });

  return { usersAffected: result.userIds.length };
}

/** Per-subject ownership breakdown for one student — powers "Manage subjects". */
export async function getStudentSubjectAccess(userId: string): Promise<SubjectAccessRow[]> {
  return getStudentSubjectAccessStore(userId);
}

/**
 * Sets a student's admin_comp subjects to exactly `subjects` (the desired end
 * state) — grants whichever of those they don't already comp-own, revokes
 * whichever comp subjects they own that aren't in the list, and no-ops on the
 * rest. Subjects owned via `paid` or `teacher_code` are untouched either way —
 * the store functions only ever write/revoke `source='admin_comp'` rows, so a
 * subject list that includes an already-teacher-owned subject simply adds a
 * redundant (harmless) comp row rather than duplicating access, and one that
 * omits it does NOT revoke the teacher grant. One recompute + one audit event
 * covers both directions, same contract as grantPremiumComp/revokePremiumComp.
 */
export async function updateStudentSubjectComp(input: {
  actorUserId: string;
  userId: string;
  subjects: Subject[];
  expiresAt?: string | null;
  requestId?: string | null;
}): Promise<{ granted: Subject[]; revoked: Subject[] }> {
  const current = await getStudentSubjectAccessStore(input.userId);
  const currentlyComped = new Set(current.filter((row) => row.comp).map((row) => row.subject));
  const desired = new Set(input.subjects);

  const toGrant = ALL_SUBJECTS.filter((s) => desired.has(s) && !currentlyComped.has(s));
  const toRevoke = ALL_SUBJECTS.filter((s) => !desired.has(s) && currentlyComped.has(s));

  if (toGrant.length === 0 && toRevoke.length === 0) {
    return { granted: [], revoked: [] };
  }

  if (toGrant.length > 0) {
    await grantAdminCompSubjectsToUser({
      userId: input.userId,
      subjects: toGrant,
      grantedBy: input.actorUserId,
      expiresAt: input.expiresAt ?? null,
    });
  }
  if (toRevoke.length > 0) {
    await revokeAdminCompSubjectsForUser({ userId: input.userId, subjects: toRevoke });
  }

  await recomputePremiumFlagsForUsers([input.userId]);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "premium_comp",
    entityId: input.userId,
    action: "premium.subject_comp_updated",
    after: {
      userId: input.userId,
      granted: toGrant,
      revoked: toRevoke,
      expiresAt: input.expiresAt ?? null,
    },
    requestId: input.requestId ?? null,
  });

  return { granted: toGrant, revoked: toRevoke };
}

export async function setPremiumEventMode(input: {
  actorUserId: string;
  active: boolean;
  autoRevertAt?: string | null;
  requestId?: string | null;
}): Promise<EventMode> {
  const eventMode = await setEventMode({
    active: input.active,
    autoRevertAt: input.autoRevertAt ?? null,
    updatedBy: input.actorUserId,
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "premium_comp",
    entityId: "event_mode",
    action: "premium.event_mode_set",
    after: { active: eventMode.active, autoRevertAt: eventMode.autoRevertAt },
    requestId: input.requestId ?? null,
  });

  return eventMode;
}

/**
 * Registration hook: while Event Mode is ON, auto-grant Premium Pro (admin_comp,
 * all four subjects) to a student who just signed up, so new signups during a
 * launch event are covered without the admin re-running "select all free". The
 * grant inherits Event Mode's auto-revert time and is attributed to the admin who
 * enabled Event Mode (granted_by). Best-effort — never throws into the signup
 * flow; a no-op for non-students, when Event Mode is off, or without Postgres.
 */
export async function maybeGrantEventModePremiumOnSignup(
  userId: string,
  role: string | null | undefined,
): Promise<void> {
  if (role !== "student") return;
  try {
    const eventMode = await getEventMode();
    if (!eventMode.active) return;
    const result = await grantAdminCompToUsers({
      userIds: [userId],
      grantedBy: eventMode.updatedBy,
      expiresAt: eventMode.autoRevertAt,
    });
    await recomputePremiumFlagsForUsers(result.userIds);
  } catch (err) {
    console.error("[premium-access] event-mode signup grant failed", err);
  }
}

/**
 * Expires lapsed grants (any source past its expires_at) and recomputes the
 * mirror for affected users. Wired into the connect-jobs drain cron — nothing
 * else in the app expires grants, so without this an admin_comp auto-revert
 * window would leave is_premium stale-true. Flag-independent (mirror correctness).
 */
export async function reconcileLapsedSubjectGrants(): Promise<{ expiredUsers: number }> {
  const { userIds } = await expireLapsedSubjectGrants();
  await recomputePremiumFlagsForUsers(userIds);
  return { expiredUsers: userIds.length };
}
