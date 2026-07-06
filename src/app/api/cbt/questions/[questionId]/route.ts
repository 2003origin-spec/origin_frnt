/**
 * GET    /api/cbt/questions/[questionId]  — fetch one question (owned)
 * PATCH  /api/cbt/questions/[questionId]  — update a question
 * DELETE /api/cbt/questions/[questionId]  — delete a question (409 if in a test)
 *
 * Cross-tenant probes return 404 (no existence oracle) — every query filters on
 * the teacher's cbt.teachers.id.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import {
  deleteCbtQuestion,
  getCbtQuestion,
  updateCbtQuestion,
  type CbtQuestionInput,
} from "@/server/cbt/cbt-questions-service";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { questionId } = await context.params;
    const question = await getCbtQuestion(ctx.cbtTeacherId, questionId);
    if (!question) return teacherJson({ detail: "Question not found." }, { status: 404 });
    return teacherJson({ question });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { questionId } = await context.params;
    const body = (await parseJsonBody(request)) as unknown as CbtQuestionInput;
    const question = await updateCbtQuestion(ctx.cbtTeacherId, questionId, body);
    if (!question) return teacherJson({ detail: "Question not found." }, { status: 404 });
    return teacherJson({ question });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { questionId } = await context.params;
    const deleted = await deleteCbtQuestion(ctx.cbtTeacherId, questionId);
    if (!deleted) return teacherJson({ detail: "Question not found." }, { status: 404 });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
