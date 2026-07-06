/** POST /api/cbt/rooms/[roomId]/configure-test — { testId }. Assign a ready test. */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { configureRoomTest } from "@/server/cbt/cbt-rooms-service";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const body = (await parseJsonBody(request)) as { testId?: string };
    if (!body.testId) return teacherJson({ detail: "testId is required." }, { status: 400 });
    const room = await configureRoomTest(ctx.cbtTeacherId, roomId, body.testId);
    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}
