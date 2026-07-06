/**
 * PUT /api/cbt/tests/[testId]/questions  — replace the full ordered question
 * list.  body: { questions: [{ questionId, marks?, negativeMarks? }] }
 * Positions are the array order.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { setTestQuestions, type CbtTestQuestionInput } from "@/server/cbt/cbt-tests-service";

type RouteContext = { params: Promise<{ testId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { testId } = await context.params;
    const body = (await parseJsonBody(request)) as { questions?: CbtTestQuestionInput[] };
    const items = Array.isArray(body.questions) ? body.questions : [];
    const test = await setTestQuestions(ctx.cbtTeacherId, testId, items);
    return teacherJson({ test });
  } catch (error) {
    return handleTeacherError(error);
  }
}
