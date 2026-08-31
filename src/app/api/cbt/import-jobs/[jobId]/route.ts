/**
 * GET    /api/cbt/import-jobs/[jobId]  — job progress + extracted questions.
 * DELETE /api/cbt/import-jobs/[jobId]  — permanently delete a queued/processing job.
 *
 * The workspace id is resolved server-side from the teacher, never client input.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { deleteCbtImportJob, getCbtImportJob } from "@/server/cbt/cbt-import-service";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { jobId } = await context.params;
    const result = await getCbtImportJob(ctx.cbtTeacher, jobId);
    if (!result) return teacherJson({ detail: "Import job not found." }, { status: 404 });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { jobId } = await context.params;
    await deleteCbtImportJob({
      teacher: ctx.cbtTeacher,
      userId: ctx.userId,
      jobId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
