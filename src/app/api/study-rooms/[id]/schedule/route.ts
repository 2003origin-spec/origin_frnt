import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { scheduleRoomTest } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  revalidateStudyRoomSurfaces,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const body = await parseJsonBody<{ scheduled_start_at?: string | null }>(request);
    const room = await scheduleRoomTest(roomId, user.id, body.scheduled_start_at ?? null);
    revalidateStudyRoomSurfaces(user.id, roomId);
    return studyRoomJson({ scheduled_start_at: room.scheduled_start_at });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
