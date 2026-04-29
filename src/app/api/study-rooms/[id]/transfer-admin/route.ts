import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { transferAdmin } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  publishPresence,
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
    const body = await parseJsonBody<{ new_admin_user_id?: string }>(request);
    await transferAdmin(roomId, user.id, body.new_admin_user_id ?? "");
    await publishRoomEvent(roomId, { type: "admin_changed", new_admin_user_id: body.new_admin_user_id ?? "" });
    await publishPresence(roomId);
    return studyRoomJson({ ok: true });
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
