/**
 * GET    /api/cbt/rooms/[roomId]  — room + participants
 * PATCH  /api/cbt/rooms/[roomId]  — { action: "close" | "finalize" |
 *                                     "finalize_participant" | "rejoin_policy" }
 * DELETE /api/cbt/rooms/[roomId]  — delete a room
 *
 * The finalize actions live here as `action` values rather than in new child
 * route files — see the Next-16 phantom-404 incident.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import {
  closeRoom,
  deleteRoom,
  getRoomForTeacher,
  getRoomWithParticipants,
  setRoomRejoinPolicy,
} from "@/server/cbt/cbt-rooms-service";
import { finalizeParticipantNow, finalizeRoomNow } from "@/server/cbt/cbt-attempts-service";
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
    const body = (await parseJsonBody(request)) as {
      action?: string;
      participantId?: string;
      rejoinPolicy?: string;
    };

    // Grade everyone still open, right now, from the answers the server holds.
    // The teacher's lever for "this student's machine died and isn't coming
    // back" — previously the only options were to wait or to close the room,
    // and closing stranded them as absent with no score.
    if (body.action === "finalize") {
      const room = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
      if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });
      if (room.status !== "in_test") {
        return teacherJson({ detail: "This room is not running a test." }, { status: 409 });
      }
      const finalized = await finalizeRoomNow(roomId, "forced_by_teacher");
      await recordAuditEvent({
        actorUserId: ctx.userId,
        workspaceId: null,
        entityType: "cbt_room",
        entityId: roomId,
        action: "cbt.room_finalized",
        requestId: requestIdOf(request),
      });
      return teacherJson({ ok: true, finalized });
    }

    if (body.action === "finalize_participant") {
      if (!body.participantId) return teacherJson({ detail: "participantId is required." }, { status: 400 });
      const room = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
      if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });
      const result = await finalizeParticipantNow(roomId, body.participantId, "forced_by_teacher");
      if (!result.finalized && !result.alreadySubmitted) {
        return teacherJson({ detail: "Participant not found." }, { status: 404 });
      }
      return teacherJson({ ok: true, ...result });
    }

    if (body.action === "rejoin_policy") {
      const policy = body.rejoinPolicy === "id_only" ? "id_only" : "name_or_id";
      const room = await setRoomRejoinPolicy(ctx.cbtTeacherId, roomId, policy);
      if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });
      return teacherJson({ ok: true, rejoinPolicy: room.rejoinPolicy });
    }

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
