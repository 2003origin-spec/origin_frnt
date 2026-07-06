/**
 * GET    /api/cbt/rooms/[roomId]  — room + participants
 * PATCH  /api/cbt/rooms/[roomId]  — { action: "close" }
 * DELETE /api/cbt/rooms/[roomId]  — delete a room
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { closeRoom, deleteRoom, getRoomWithParticipants } from "@/server/cbt/cbt-rooms-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const room = await getRoomWithParticipants(ctx.cbtTeacherId, roomId);
    if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });
    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const body = (await parseJsonBody(request)) as { action?: string };
    if (body.action === "close") {
      const closed = await closeRoom(ctx.cbtTeacherId, roomId);
      if (!closed) return teacherJson({ detail: "Room not found or already closed." }, { status: 404 });
      await recordAuditEvent({
        actorUserId: ctx.userId,
        workspaceId: null,
        entityType: "cbt_room",
        entityId: roomId,
        action: "cbt.room_closed",
        requestId: requestIdOf(request),
      });
      return teacherJson({ ok: true });
    }
    return teacherJson({ detail: "Unknown action." }, { status: 400 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const deleted = await deleteRoom(ctx.cbtTeacherId, roomId);
    if (!deleted) return teacherJson({ detail: "Room not found." }, { status: 404 });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
