/**
 * GET  /api/cbt/questions  — list the signed-in teacher's questions
 * POST /api/cbt/questions  — create a question
 *
 * Role-gated to cbt_teacher (middleware) + requireCbtTeacher (active allowlist).
 * Every query is scoped to the teacher's cbt.teachers.id.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import {
  createCbtQuestion,
  listCbtQuestions,
  type CbtQuestionInput,
} from "@/server/cbt/cbt-questions-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const questions = await listCbtQuestions(ctx.cbtTeacherId);
    return teacherJson({ questions });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await parseJsonBody(request)) as unknown as CbtQuestionInput;
    const question = await createCbtQuestion(ctx.cbtTeacherId, body);
    return teacherJson({ question }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
