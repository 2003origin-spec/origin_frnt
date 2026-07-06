/**
 * GET /api/cbt/rooms/[roomId]/participants/[participantId] — per-question
 * drill-down for one participant (teacher-only, ownership-scoped).
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { getParticipantDrilldown } from "@/server/cbt/cbt-analytics-service";

type RouteContext = { params: Promise<{ roomId: string; participantId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId, participantId } = await context.params;
    const drilldown = await getParticipantDrilldown(ctx.cbtTeacherId, roomId, participantId);
    if (!drilldown) return teacherJson({ detail: "Not found." }, { status: 404 });
    return teacherJson(drilldown);
  } catch (error) {
    return handleTeacherError(error);
  }
}
