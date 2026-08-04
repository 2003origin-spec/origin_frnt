/**
 * GET /api/cbt/rooms/[roomId]/participants/[participantId] — per-question
 * drill-down for one participant (teacher-only, ownership-scoped).
 *
 * `?view=report` returns the FULL report card instead — the same payload the
 * student sees behind the shareable link, so the teacher can check exactly what
 * was published. Served as a query mode on this file rather than a child route
 * (Next-16 phantom-404 incident).
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { getParticipantDrilldown } from "@/server/cbt/cbt-analytics-service";
import { getCbtReportCard } from "@/server/cbt/cbt-report-service";
import { getRoomForTeacher } from "@/server/cbt/cbt-rooms-service";

type RouteContext = { params: Promise<{ roomId: string; participantId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId, participantId } = await context.params;

    if (new URL(request.url).searchParams.get("view") === "report") {
      requireFeatureEnabled("cbtReportCards");
      if (!ctx.cbtTeacher.reportCardsEnabled) {
        return teacherJson({ detail: "Report cards are not enabled for your account." }, { status: 403 });
      }
      // Ownership: getCbtReportCard is not teacher-scoped (the public route
      // reaches it through the slug), so the room must be verified here.
      const room = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
      if (!room) return teacherJson({ detail: "Not found." }, { status: 404 });
      const report = await getCbtReportCard({ roomId, participantId });
      if (!report) return teacherJson({ detail: "Not found." }, { status: 404 });
      return teacherJson({ report });
    }

    const drilldown = await getParticipantDrilldown(ctx.cbtTeacherId, roomId, participantId);
    if (!drilldown) return teacherJson({ detail: "Not found." }, { status: 404 });
    return teacherJson(drilldown);
  } catch (error) {
    return handleTeacherError(error);
  }
}
