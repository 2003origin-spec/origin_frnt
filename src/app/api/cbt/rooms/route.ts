/**
 * GET  /api/cbt/rooms  — list the teacher's rooms
 * POST /api/cbt/rooms  — create a room (returns the plaintext code once)
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createRoom, listRooms } from "@/server/cbt/cbt-rooms-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const rooms = await listRooms(ctx.cbtTeacherId);
    return teacherJson({ rooms });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await parseJsonBody(request)) as {
      name?: string;
      capacity?: number;
      rejoinPolicy?: string;
    };
    const { room, code } = await createRoom(ctx.cbtTeacherId, {
      ...body,
      rejoinPolicy: body.rejoinPolicy === "id_only" ? "id_only" : "name_or_id",
    });
    return teacherJson({ room, code }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
