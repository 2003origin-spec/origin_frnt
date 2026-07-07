/**
 * POST /api/cbt/import-jobs/[jobId]/create-test — commit the job's accepted
 * questions, group them into a new cluster, and create a test seeded with them.
 * Returns { testId } for the client to open the builder. Workspace resolved
 * server-side from the teacher.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createTestFromImportJob } from "@/server/cbt/cbt-import-service";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { jobId } = await context.params;
    const result = await createTestFromImportJob({ teacher: ctx.cbtTeacher, jobId });
    return teacherJson(result, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
