/**
 * GET /api/cbt-student/state — sanitized room + participant state for the
 * signed-in participant (from the cookie). No answers ever.
 */

import type { NextRequest } from "next/server";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function GET(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });
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
    });
  } catch (error) {
    return handleStudentError(error);
  }
}
