// audit-skip: student submits their OWN attempt (own-row finalize; the attempt
// row + submission_answers are the record; no admin/config mutation).
/**
 * POST /api/contest/submit  body: { contestId, violationCount?, malpractice?,
 * final? }  — manual submit of the rated attempt. Idempotent (a double-submit
 * returns alreadySubmitted). The deadline auto-submit is handled by the
 * contest-service finalize sweep (Phase 4 worker). Plan Phase 4.
 *
 * `final` (optional, so older clients keep working) carries the client's last
 * draft. It is applied through the same rev CAS as /answers before grading (a
 * stale rev is ignored) and dropped once end_at + grace has passed, or when
 * this session was superseded by another device. A superseded session's
 * malpractice submit is refused (409 session_superseded) and its violation count
 * is dropped, so an abandoned tab can never flag the live attempt. A submit
 * after the deadline is never rejected: it is finalized as `deadline`.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { planContestSubmit } from "@/lib/contest/submit-flow";
import { requireFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { isActiveSession } from "@/server/contest/contest-session-registry";
import {
  applySubmitFinal,
  isContestWriteWindowOpenCached,
  submitAttempt,
} from "@/server/contest/contest-submit-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SubmitSchema = z.object({
  contestId: z.string().min(1),
  violationCount: z.number().int().min(0).optional(),
  malpractice: z.boolean().optional(),
  final: z
    .object({
      answers: z.record(z.string(), z.unknown()).optional(),
      palette: z.record(z.string(), z.unknown()).optional(),
      times: z.record(z.string(), z.unknown()).optional(),
      rev: z.number(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireFeatureEnabledRuntime("contest");
    const ctx = await requireAuth(request);
    const parsed = SubmitSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const { contestId, violationCount, malpractice, final } = parsed.data;

    // Same single-active-session rule as /answers: a superseded tab must not
    // WRITE a draft (it could clobber the active tab's answers), and must not
    // put its anti-cheat strikes on the live attempt (planContestSubmit). A
    // plain submit from it still finalizes, graded from the active session's
    // buffered draft, so a Submit tapped on the old device really closes the
    // attempt instead of it staying open until the deadline sweep.
    const plan = planContestSubmit({
      activeSession: await isActiveSession(contestId, ctx.userId, ctx.sessionId),
      malpractice,
      violationCount,
    });
    if (plan.kind === "refuse") return teacherJson({ detail: plan.detail }, { status: 409 });

    if (final && plan.writeFinal) {
      // Cached end_at (no Neon read on the hot path); the authoritative DB-clock
      // deadline check is inside submitAttempt's transaction.
      const windowOpen = await isContestWriteWindowOpenCached(contestId);
      const applied = await applySubmitFinal(contestId, ctx.userId, final, windowOpen);
      if (!applied.applied && "code" in applied) {
        // A malformed/oversized final can never succeed on retry, so it must not
        // block the submit: grade from the buffered draft instead.
        console.warn("[contest submit] final draft rejected", contestId, applied.code, applied.reason);
      }
    }

    const result = await submitAttempt(contestId, ctx.userId, plan.reason, {
      violationCount: plan.violationCount,
      malpractice: plan.malpractice,
    });
    return teacherJson({ result });
  } catch (error) {
    return handleTeacherError(error);
  }
}
