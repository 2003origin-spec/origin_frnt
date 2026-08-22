// audit-skip: student practice — reads/records the caller's own practice
// progress; separate from the rated attempt, no admin/state mutation.
/**
 * Pre-contest practice API (plan Phase 2c). All registered-only.
 *   GET  /api/contest/practice?contestId=&mode=questions&subject=&limit=&offset=
 *   GET  /api/contest/practice?contestId=&mode=metrics
 *   POST /api/contest/practice   body: { contestId, questionId, selectedOption }
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import {
  getPracticeMetrics,
  getPracticeQuestions,
  recordPracticeAttempt,
} from "@/server/contest/contest-practice-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });

    const mode = url.searchParams.get("mode") ?? "questions";
    if (mode === "metrics") {
      return teacherJson({ metrics: await getPracticeMetrics(contestId, ctx.userId) });
    }
    const subject = url.searchParams.get("subject");
    const limit = Number(url.searchParams.get("limit")) || 20;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const page = await getPracticeQuestions(contestId, ctx.userId, { subject, limit, offset });
    return teacherJson(page);
  } catch (error) {
    return handleTeacherError(error);
  }
}

const AttemptSchema = z.object({
  contestId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOption: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = AttemptSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const { contestId, questionId, selectedOption } = parsed.data;
    const result = await recordPracticeAttempt(contestId, ctx.userId, questionId, selectedOption);
    // result = { isCorrect, correctOption, correctOptions, explanation, metrics }
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
