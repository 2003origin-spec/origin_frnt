/**
 * Workspace staff-member management (Phase 8).
 *
 * Backs the teacher Settings → Staff panel, which previously faked invite / role
 * / deactivate entirely in the client (`Math.random()` member, no persistence).
 * The member store (`app.workspace_members`) already existed — these services
 * wire the real operations, guarding the owner and requiring an existing Origin
 * teacher account for invites.
 *
 * Inviting a brand-new (non-registered) person via an email token + accept flow
 * is a documented follow-up; today an invite targets an existing teacher account.
 */

import { dbFindUserByEmail } from "@/server/db-users";
import {
  findMember,
  setMemberRole,
  setMemberStatus,
  upsertMember,
} from "@/server/workspaces/store";
import type {
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "@/server/workspaces/types";

export class MemberServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MemberServiceError";
  }
}

/** Roles that can be assigned through the staff panel (never `owner`). */
export const ASSIGNABLE_MEMBER_ROLES: WorkspaceMemberRole[] = [
  "admin",
  "teacher",
  "content_manager",
  "analyst",
  "support",
];

export async function inviteMemberByEmail(
  workspaceId: string,
  actorUserId: string,
  email: string,
  role: WorkspaceMemberRole,
): Promise<{ member: WorkspaceMember; name: string }> {
  const user = await dbFindUserByEmail(email.trim(), "teacher");
  if (!user) {
    throw new MemberServiceError(
      404,
      "No Origin teacher account found for that email. Ask them to sign up as a teacher first.",
    );
  }
  const existing = await findMember(workspaceId, user.id);
  if (existing && existing.status === "active") {
    throw new MemberServiceError(409, "That person is already an active staff member.");
  }
  const member = await upsertMember({
    workspaceId,
    userId: user.id,
    role,
    status: "active",
    invitedBy: actorUserId,
  });
  return { member, name: user.name };
}

async function requireModifiableMember(workspaceId: string, userId: string): Promise<WorkspaceMember> {
  const member = await findMember(workspaceId, userId);
  if (!member) {
    throw new MemberServiceError(404, "Member not found.");
  }
  if (member.role === "owner") {
    throw new MemberServiceError(400, "The workspace owner cannot be modified.");
  }
  return member;
}

export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceMemberRole,
): Promise<WorkspaceMember> {
  await requireModifiableMember(workspaceId, userId);
  const updated = await setMemberRole(workspaceId, userId, role);
  if (!updated) throw new MemberServiceError(404, "Member not found.");
  return updated;
}

export async function changeMemberStatus(
  workspaceId: string,
  userId: string,
  status: WorkspaceMemberStatus,
): Promise<WorkspaceMember> {
  await requireModifiableMember(workspaceId, userId);
  const updated = await setMemberStatus(workspaceId, userId, status);
  if (!updated) throw new MemberServiceError(404, "Member not found.");
  return updated;
}
