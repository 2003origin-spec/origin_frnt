/**
 * POST /api/contest/dpp/answer — grade one DPP-from-mistakes answer and return
 * the reveal (correct option + explanation). Gated (published + registered +
 * premium) inside the service so the answer key never leaks. Plan Phase 8c UI.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { gradeContestDppAnswer } from "@/server/contest/contest-dpp-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const AnswerSchema = z.object({
  contestId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOption: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = AnswerSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const { contestId, questionId, selectedOption } = parsed.data;
    const result = await gradeContestDppAnswer(contestId, ctx.userId, questionId, selectedOption);
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
