import type { NextRequest } from "next/server";

import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { finishRoomParticipant } from "@/server/study-rooms";
import {
  getRoomId,
  handleStudyRoomError,
  requireStudyRoomUser,
  studyRoomJson,
  type IdRouteContext,
} from "@/app/api/study-rooms/_utils";

/**
 * Auto-submit signal: the participant's timer ran out (or they gave up)
 * without a graded submission. The request body is deliberately ignored —
 * `score`, `time_taken_seconds` and `auto_submitted` used to be read from it,
 * which let any participant rewrite their own room score/rank. The only
 * scored path is `submitRoomTest`, where the score is computed server-side.
 */
export async function POST(request: NextRequest, context: IdRouteContext) {
  try {
    const user = await requireStudyRoomUser(request);
    const limited = await checkRateLimit(generalLimiter, user.id);
    if (limited) return limited;
    const roomId = await getRoomId(context);
    const result = await finishRoomParticipant(roomId, user.id, {
      testResultId: null,
      score: null,
      timeTakenSeconds: null,
      autoSubmitted: true,
    });
    await publishRoomEvent(roomId, { type: "participant_finished", user_id: user.id, rank: result.rank });
    if (result.ended_at) {
      await publishRoomEvent(roomId, { type: "test_ended", ended_at: result.ended_at });
    }
    return studyRoomJson(result);
  } catch (error) {
    return handleStudyRoomError(error);
  }
}
