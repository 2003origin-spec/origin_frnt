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
    return studentJson({ payload, draft, studentCode: participant.studentCode });
  } catch (error) {
    return handleStudentError(error);
  }
}
