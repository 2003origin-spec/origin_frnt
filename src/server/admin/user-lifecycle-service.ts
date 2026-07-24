/**
 * Admin user lifecycle (Feature B) — revoke / unrevoke / delete orchestration for
 * the /admin/users console. Enforcement (login gating + re-signup block) lives in
 * the auth handlers and is unconditional; this service performs the admin ACTIONS
 * (behind the adminUserLifecycle flag at the API layer).
 *
 * Delete semantics (D7, distinct from the GDPR self-service anonymize in
 * account-deletion.ts): RETAIN name/email/mobile as a tombstone, block re-signup
 * by email/mobile, cancel subscriptions, kill sessions + device tokens, purge
 * personal owned content, suspend owned teacher workspaces. Terminal (D9); revoke
 * is reversible. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import {
  dbFindUserById,
  dbIncrementAuthTokenVersionAndRevokeSessions,
  dbListUsersForAdmin,
  dbPurgeDeletedUserData,
  dbSetAccountStatus,
  type AdminUserRow,
} from "@/server/db-users";
import { cancelActiveSubscriptions } from "@/server/account-deletion";
import { isMainAdmin } from "@/server/admin/admins-service";
import { addIdentityToBlocklist } from "@/server/user-lifecycle-store";
import { revokeDeviceTokensForUser } from "@/server/push/device-tokens";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { getUserPostgresPool } from "@/server/user-postgres";
import { listCodesForWorkspace, revokeWorkspaceCode, updateWorkspace } from "@/server/workspaces/store";
import type { StoredUser } from "@/server/store";

export class UserLifecycleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "UserLifecycleError";
  }
}

/**
 * Guardrails (D10): no self-target, never a main admin, and only the main admin
 * may act on other admin accounts. Returns the resolved target user.
 */
async function assertActable(actorId: string, targetUserId: string): Promise<StoredUser> {
  if (actorId === targetUserId) {
    throw new UserLifecycleError(400, "You cannot change your own account status.");
  }
  const target = await dbFindUserById(targetUserId);
  if (!target) throw new UserLifecycleError(404, "User not found.");
  if (await isMainAdmin(targetUserId)) {
    throw new UserLifecycleError(403, "The main admin account cannot be revoked or deleted.");
  }
  if (target.role === "admin" && !(await isMainAdmin(actorId))) {
    throw new UserLifecycleError(403, "Only the main admin can act on admin accounts.");
  }
  return target;
}

export async function listUsersForAdmin(input: {
  query?: string;
  status?: string;
  limit?: number;
}): Promise<AdminUserRow[]> {
  return dbListUsersForAdmin(input);
}

export async function revokeUser(input: {
  actorId: string;
  userId: string;
  reason?: string | null;
}): Promise<void> {
  const target = await assertActable(input.actorId, input.userId);
  if (target.accountStatus === "deleted") {
    throw new UserLifecycleError(409, "This account is deleted and cannot be revoked.");
  }
  await dbSetAccountStatus(input.userId, "revoked", input.reason ?? null, input.actorId);
  // Kill live sessions immediately (in-flight JWTs die at the next version check).
  await dbIncrementAuthTokenVersionAndRevokeSessions(input.userId);
  try {
    await revokeDeviceTokensForUser(input.userId);
  } catch (error) {
    console.error("[user-lifecycle] device-token revoke failed", error instanceof Error ? error.message : error);
  }
  await recordAuditEvent({
    actorUserId: input.actorId,
    workspaceId: null,
    entityType: "user",
    entityId: input.userId,
    action: "user.revoked",
    after: { reason: input.reason ?? null },
    requestId: null,
  });
}

export async function unrevokeUser(input: { actorId: string; userId: string }): Promise<void> {
  const target = await assertActable(input.actorId, input.userId);
  if (target.accountStatus !== "revoked") {
    throw new UserLifecycleError(409, "This account is not revoked.");
  }
  await dbSetAccountStatus(input.userId, "active", null, input.actorId);
  await recordAuditEvent({
    actorUserId: input.actorId,
    workspaceId: null,
    entityType: "user",
    entityId: input.userId,
    action: "user.unrevoked",
    after: {},
    requestId: null,
  });
}

/** Suspends the user's owned teacher workspaces + revokes their codes (best-effort). */
async function suspendOwnedWorkspaces(userId: string): Promise<void> {
  const pool = getUserPostgresPool();
  if (!pool) return;
  const res = await pool.query(
    "SELECT id FROM app.teacher_workspaces WHERE owner_user_id = $1 AND status NOT IN ('suspended','closed')",
    [userId],
  );
  for (const row of res.rows) {
    const wsId = row.id as string;
    await updateWorkspace(wsId, { status: "suspended" });
    const codes = await listCodesForWorkspace(wsId, "student_join");
    for (const code of codes) {
      if (code.status === "active" || code.status === "reserved") {
        await revokeWorkspaceCode(code.id, wsId);
      }
    }
  }
}

export async function adminDeleteUser(input: {
  actorId: string;
  userId: string;
  reason?: string | null;
}): Promise<{ warnings: string[] }> {
  const target = await assertActable(input.actorId, input.userId);
  if (target.accountStatus === "deleted") {
    throw new UserLifecycleError(409, "This account is already deleted.");
  }

  const warnings: string[] = [];
  // Cancel subscriptions first — a deleted account must never keep charging.
  await cancelActiveSubscriptions(input.userId, warnings);

  // Purge personal content + clear minor PII (name/email/mobile are RETAINED).
  await dbPurgeDeletedUserData(input.userId);
  await dbSetAccountStatus(input.userId, "deleted", input.reason ?? null, input.actorId);
  await dbIncrementAuthTokenVersionAndRevokeSessions(input.userId);
  try {
    await revokeDeviceTokensForUser(input.userId);
  } catch (error) {
    console.error("[user-lifecycle] device-token revoke failed", error instanceof Error ? error.message : error);
  }

  // Block re-signup with this identity (email + mobile).
  await addIdentityToBlocklist({
    userId: input.userId,
    email: target.email,
    mobile: target.mobile,
    reason: input.reason ?? null,
    deletedBy: input.actorId,
  });

  // If the user owns teacher workspaces, suspend them + revoke their codes.
  try {
    await suspendOwnedWorkspaces(input.userId);
  } catch (error) {
    console.error("[user-lifecycle] workspace suspend failed", error instanceof Error ? error.message : error);
    warnings.push("Could not fully suspend the user's institutes — check /admin/workspaces.");
  }

  await recordAuditEvent({
    actorUserId: input.actorId,
    workspaceId: null,
    entityType: "user",
    entityId: input.userId,
    action: "user.deleted",
    after: { reason: input.reason ?? null, retained: { name: target.name, email: target.email, mobile: target.mobile } },
    requestId: null,
  });

  return { warnings };
}
