/**
 * Teacher-side code-access endpoint (Feature A). GET returns the dashboard
 * state; POST {action:'request'} opens a code-access request; POST
 * {action:'cancel'} withdraws the pending one. Gated by teacherCodeApproval +
 * workspace ownership. Admin approval lives under /api/admin/teacher-code-requests.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import {
  cancelCodeRequest,
  createCodeRequest,
  getCodeAccessState,
} from "@/server/workspaces/code-access-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    studentCount: z.number().int().positive().max(100000),
    aiAccess: z.boolean(),
  }),
  z.object({ action: z.literal("cancel"), requestId: z.string().min(1) }),
]);

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherCodeApproval");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    return teacherJson(await getCodeAccessState(workspaceId));
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherCodeApproval");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceOwnerOrAdmin(request, workspaceId);
    const body = await parseJsonBody(request);
    const parsed = bodySchema.parse(body);

    if (parsed.action === "request") {
      const result = await createCodeRequest({
        workspaceId,
        actorUserId: ctx.auth.userId,
        studentCount: parsed.studentCount,
        aiAccess: parsed.aiAccess,
        requestId: requestIdOf(request),
      });
      return teacherJson(result, { status: 201 });
    }

    const cancelled = await cancelCodeRequest({
      workspaceId,
      requestId: parsed.requestId,
      actorUserId: ctx.auth.userId,
      requestIdHeader: requestIdOf(request),
    });
    return teacherJson({ request: cancelled });
  } catch (error) {
    return handleTeacherError(error);
  }
}
