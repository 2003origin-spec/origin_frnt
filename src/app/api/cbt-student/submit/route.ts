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
    let malpractice = false;
    let violationCount = 0;
    try {
      const body = raw ? (JSON.parse(raw) as { auto?: boolean; malpractice?: boolean; violations?: number }) : {};
      auto = Boolean(body.auto);
      malpractice = Boolean(body.malpractice);
      violationCount = Math.max(0, Math.floor(Number(body.violations) || 0));
    } catch {
      auto = false;
    }

    // The player has always sent `malpractice`; it used to be dropped here, so
    // an integrity termination was indistinguishable from a timer auto-submit
    // in the export. It is now recorded as the finalize reason.
    const result = await submitAttempt(participant, room, {
      reason: malpractice ? "malpractice" : auto ? "timer" : "manual",
      violationCount,
    });
    // Students never see their score here — only confirmation.
    return studentJson({ ok: true, submitted: true, alreadySubmitted: result.alreadySubmitted });
  } catch (error) {
    return handleStudentError(error);
  }
}
