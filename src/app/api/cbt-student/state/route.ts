/**
 * GET /api/cbt-student/state — sanitized room + participant state for the
 * signed-in participant (from the cookie). No answers ever.
 */

import type { NextRequest } from "next/server";

import { finalizeIfExpired, resolveParticipantFromToken } from "@/server/cbt/cbt-rooms-service";
import { CBT_PARTICIPANT_COOKIE } from "@/lib/cbt/participant-token";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function GET(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    let resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });

    // A student coming back after the deadline must land on the "submitted"
    // screen, not an un-finalized test. Finalizing here also means the act of
    // reopening the room link grades everyone whose time is already up.
    if (await finalizeIfExpired(resolved.room)) {
      const token = request.cookies.get(CBT_PARTICIPANT_COOKIE)?.value;
      resolved = (await resolveParticipantFromToken(token)) ?? resolved;
    }

    const { participant, room } = resolved;
    return studentJson({
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        startedAt: room.startedAt,
        durationSeconds: room.durationSeconds,
        hasTest: Boolean(room.testId),
      },
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        studentCode: participant.studentCode,
        status: participant.status,
        finishedAt: participant.finishedAt,
        enteredTestAt: participant.enteredTestAt,
      },
      /** Server clock, so the player can correct a skewed device clock. */
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return handleStudentError(error);
  }
}
