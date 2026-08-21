/**
 * POST /api/admin/contest/[id]/cancel — cancel a draft/scheduled contest before
 * it ends (terminal state 'cancelled'; registrations retained). Admin-only +
 * `contest` flag; writes an audit event.
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { cancelContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const contest = await cancelContest(id);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.cancelled",
      after: { status: contest.status },
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}
