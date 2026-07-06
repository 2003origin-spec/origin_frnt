/** POST /api/cbt/rooms/[roomId]/start — start the assigned test. */

import type { NextRequest } from "next/server";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { startRoomTest } from "@/server/cbt/cbt-rooms-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const result = await startRoomTest(ctx.cbtTeacherId, roomId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_room",
      entityId: roomId,
      action: "cbt.room_started",
      after: { startedAt: result.startedAt, durationSeconds: result.durationSeconds },
      requestId: requestIdOf(request),
    });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
