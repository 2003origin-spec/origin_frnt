/**
 * POST /api/admin/contest/[id]/clone — duplicate a contest's config into a fresh
 * draft (fast weekly re-run). Admin-only + `contest` flag; audited.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { cloneContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const contest = await cloneContest(id, ctx.userId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.cloned",
      after: { from: id },
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}
