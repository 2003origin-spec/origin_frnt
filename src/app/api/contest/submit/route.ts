// audit-skip: student submits their OWN attempt (own-row finalize; the attempt
// row + submission_answers are the record; no admin/config mutation).
/**
 * POST /api/contest/submit  body: { contestId }  — manual submit of the rated
 * attempt. Idempotent (a double-submit returns alreadySubmitted). The deadline
 * auto-submit is handled by the contest-service finalize sweep (Phase 4 worker).
 * Plan Phase 4.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { submitAttempt } from "@/server/contest/contest-submit-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SubmitSchema = z.object({
  contestId: z.string().min(1),
  violationCount: z.number().int().min(0).optional(),
  malpractice: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = SubmitSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const { contestId, violationCount, malpractice } = parsed.data;
    // A malpractice submit is still an "auto" close (3rd-strike auto-submit), not
    // a voluntary manual one.
    const result = await submitAttempt(contestId, ctx.userId, malpractice ? "auto" : "manual", {
      violationCount,
      malpractice,
    });
    return teacherJson({ result });
  } catch (error) {
    return handleTeacherError(error);
  }
}
