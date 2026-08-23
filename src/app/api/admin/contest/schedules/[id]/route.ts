/**
 * PATCH  /api/admin/contest/schedules/[id]  { active } — pause/resume.
 * DELETE /api/admin/contest/schedules/[id]              — remove.
 * Admin-only + `contest` flag.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { setScheduleActive, deleteSchedule } from "@/server/contest/contest-schedule-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const PatchSchema = z.object({ active: z.boolean() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = PatchSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    await setScheduleActive(id, parsed.data.active);
    await recordAuditEvent({
      actorUserId: ctx.userId, workspaceId: null, entityType: "contest", entityId: id,
      action: "contest.schedule_toggled", after: { active: parsed.data.active },
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    await deleteSchedule(id);
    await recordAuditEvent({
      actorUserId: ctx.userId, workspaceId: null, entityType: "contest", entityId: id,
      action: "contest.schedule_deleted",
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
