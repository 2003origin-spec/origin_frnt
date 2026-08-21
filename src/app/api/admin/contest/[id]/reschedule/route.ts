/**
 * POST /api/admin/contest/[id]/reschedule — move a scheduled contest's window
 * before it goes live. Admin-only + `contest` flag; writes an audit event.
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { rescheduleContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const iso = z.string().datetime({ offset: true });
const RescheduleSchema = z.object({
  regOpen: iso,
  regClose: iso,
  startAt: iso,
  endAt: iso,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = RescheduleSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const contest = await rescheduleContest(id, parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.rescheduled",
      after: { startAt: contest.startAt, endAt: contest.endAt },
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}
