import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import {
  inviteMemberByEmail,
  changeMemberRole,
  changeMemberStatus,
} from "@/server/workspaces/member-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string }>;
};

const ROLE = z.enum(["admin", "teacher", "content_manager", "analyst", "support"]);

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: ROLE,
});

const updateSchema = z
  .object({
    userId: z.string().min(1),
    role: ROLE.optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide a role or status to update.",
  });

/** POST — invite an existing Origin teacher account as workspace staff. */
export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("workspaces");
    const { workspaceId } = await context.params;
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const { email, role } = inviteSchema.parse(body);

    const { member, name } = await inviteMemberByEmail(workspaceId, ctx.auth.userId, email, role);
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "workspace_member",
      entityId: member.userId,
      action: "member.invited",
      before: null,
      after: member,
      requestId: requestIdOf(request),
    });
    return teacherJson({ member, name });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/** PATCH — change a staff member's role and/or active status. */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("workspaces");
    const { workspaceId } = await context.params;
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const { userId, role, status } = updateSchema.parse(body);

    let member;
    if (role !== undefined) {
      member = await changeMemberRole(workspaceId, userId, role);
    }
    if (status !== undefined) {
      member = await changeMemberStatus(workspaceId, userId, status);
    }
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "workspace_member",
      entityId: userId,
      action: "member.updated",
      before: null,
      after: member,
      requestId: requestIdOf(request),
    });
    return teacherJson({ member });
  } catch (error) {
    return handleTeacherError(error);
  }
}
