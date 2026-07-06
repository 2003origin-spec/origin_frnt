/** POST /api/cbt/rooms/[roomId]/code — regenerate the room's join code. */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { regenerateRoomCode } from "@/server/cbt/cbt-rooms-service";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const result = await regenerateRoomCode(ctx.cbtTeacherId, roomId);
    if (!result) return teacherJson({ detail: "Room not found." }, { status: 404 });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
