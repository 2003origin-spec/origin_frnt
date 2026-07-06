/** GET /api/cbt/rooms/[roomId]/leaderboard — authoritative leaderboard (teacher). */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { getRoomLeaderboard } from "@/server/cbt/cbt-analytics-service";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const board = await getRoomLeaderboard(ctx.cbtTeacherId, roomId);
    if (!board) return teacherJson({ detail: "Room not found." }, { status: 404 });
    return teacherJson(board);
  } catch (error) {
    return handleTeacherError(error);
  }
}
