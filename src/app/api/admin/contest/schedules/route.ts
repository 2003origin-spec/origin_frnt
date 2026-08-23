/**
 * GET  /api/admin/contest/schedules — list recurring schedules.
 * POST /api/admin/contest/schedules — create one (audited).
 * Admin-only + `contest` flag.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { createSchedule, listSchedules } from "@/server/contest/contest-schedule-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subjects: z.array(z.string()).min(1),
  topics: z.record(z.string(), z.array(z.string())).optional(),
  selections: z.array(z.object({ subject: z.string().min(1), count: z.number().int().min(1).max(100), topics: z.array(z.string()).optional() })).min(1),
  durationMinutes: z.number().int().min(1).max(600),
  regLeadDays: z.number().int().min(0).max(30).optional(),
  cadenceDays: z.number().int().min(1).max(90).optional(),
  ogcodeReward: z.number().int().min(0).optional(),
  firstStartAt: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    return teacherJson({ schedules: await listSchedules() });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = CreateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const schedule = await createSchedule(ctx.userId, parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId, workspaceId: null, entityType: "contest", entityId: schedule.id,
      action: "contest.schedule_created", after: { name: schedule.name, cadenceDays: schedule.cadenceDays },
    });
    return teacherJson({ schedule });
  } catch (error) {
    return handleTeacherError(error);
  }
}
