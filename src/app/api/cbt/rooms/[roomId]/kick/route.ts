/** POST /api/cbt/rooms/[roomId]/kick — { participantId }. Revokes their token. */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { kickParticipant } from "@/server/cbt/cbt-rooms-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const body = (await parseJsonBody(request)) as { participantId?: string };
    if (!body.participantId) return teacherJson({ detail: "participantId is required." }, { status: 400 });
    const ok = await kickParticipant(ctx.cbtTeacherId, roomId, body.participantId);
    if (!ok) return teacherJson({ detail: "Participant not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_room",
      entityId: roomId,
      action: "cbt.participant_kicked",
      after: { participantId: body.participantId },
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
