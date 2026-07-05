import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { extendTeacherRoomDuration } from "@/server/workspaces/teacher-rooms-service";
import { publishRoomEvent } from "@/server/rooms-pubsub";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; roomId: string }> },
) {
  try {
    requireFeatureEnabled("liveRooms");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const { roomId } = await context.params;

    const room = await extendTeacherRoomDuration({
      actorUserId: ctx.auth.userId,
      workspaceId,
      roomId,
      additionalSeconds: 300,
    });

    await publishRoomEvent(roomId, {
      type: "time_extended",
      duration_seconds: room.durationSeconds!,
    });

    void requestIdOf(request);
    return teacherJson({ room });
  } catch (error) {
    return handleTeacherError(error);
  }
}
