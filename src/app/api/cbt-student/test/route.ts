/**
 * GET /api/cbt-student/test — sanitized test payload + the student's own draft
 * (for resume). NEVER includes answers/explanations.
 */

import type { NextRequest } from "next/server";

import { getStudentTestPayload, loadDraft } from "@/server/cbt/cbt-attempts-service";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function GET(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });
    const { participant, room } = resolved;
    const payload = await getStudentTestPayload(participant, room);
    const draft = await loadDraft(room.id, participant.id);
    return studentJson({
      payload,
      draft,
      studentCode: participant.studentCode,
      participantId: participant.id,
      /** Non-null on a resume — the player then skips the instructions gate. */
      enteredTestAt: participant.enteredTestAt,
      /**
       * Server clock at response time. The player derives a skew offset from it
       * so a device whose clock runs fast can't hit "time up" the moment the
       * paper loads.
       */
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return handleStudentError(error);
  }
}
