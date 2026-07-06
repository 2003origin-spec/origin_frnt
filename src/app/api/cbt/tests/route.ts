/**
 * GET  /api/cbt/tests  — list the teacher's tests
 * POST /api/cbt/tests  — create a test   body: { title, description?, durationMinutes? }
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createCbtTest, listCbtTests } from "@/server/cbt/cbt-tests-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const tests = await listCbtTests(ctx.cbtTeacherId);
    return teacherJson({ tests });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await parseJsonBody(request)) as {
      title?: string;
      description?: string | null;
      durationMinutes?: number;
    };
    const test = await createCbtTest(ctx.cbtTeacherId, body);
    return teacherJson({ test }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
