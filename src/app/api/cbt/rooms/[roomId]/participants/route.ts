/** GET /api/cbt/rooms/[roomId]/participants — participant list (polling fallback). */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { getRoomForTeacher, listParticipants } from "@/server/cbt/cbt-rooms-service";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const room = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
    if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });
    const participants = await listParticipants(roomId, room.status);
    return teacherJson({ participants });
  } catch (error) {
    return handleTeacherError(error);
  }
}
