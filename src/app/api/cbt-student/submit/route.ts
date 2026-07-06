/** POST /api/cbt-student/submit — grade from the server-held draft (idempotent). */

import type { NextRequest } from "next/server";

import { submitAttempt } from "@/server/cbt/cbt-attempts-service";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function POST(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });
    const { participant, room } = resolved;

    const raw = await request.text().catch(() => "");
    let auto = false;
    try {
      auto = Boolean(raw ? (JSON.parse(raw) as { auto?: boolean }).auto : false);
    } catch {
      auto = false;
    }

    const result = await submitAttempt(participant, room, { auto });
    // Students never see their score here — only confirmation.
    return studentJson({ ok: true, submitted: true, alreadySubmitted: result.alreadySubmitted });
  } catch (error) {
    return handleStudentError(error);
  }
}
