/**
 * GET /api/cbt/rooms/[roomId]/export[?detail=1] — download results as .xlsx.
 * Teacher-only + ownership-scoped; audited as cbt.results_exported.
 */

import { NextResponse, type NextRequest } from "next/server";

import { cbtExportLimiter, checkRateLimit } from "@/lib/rate-limit";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { buildResultsWorkbook } from "@/server/cbt/cbt-export-service";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const limited = await checkRateLimit(cbtExportLimiter, ctx.cbtTeacherId);
    if (limited) return limited as unknown as NextResponse;
    const detail = new URL(request.url).searchParams.get("detail") === "1";

    const result = await buildResultsWorkbook(ctx.cbtTeacherId, roomId, { detail });
    if (!result) return teacherJson({ detail: "Room not found." }, { status: 404 });

    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_room",
      entityId: roomId,
      action: "cbt.results_exported",
      after: { detail },
      requestId: requestIdOf(request),
    });

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}
