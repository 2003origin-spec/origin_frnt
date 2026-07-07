/**
 * POST /api/cbt/import-jobs/[jobId]/commit — bulk-publish all `accepted`
 * import questions into the CBT question bank. Idempotent. The workspace id is
 * resolved server-side from the teacher, never client input.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { commitImportJobToBank } from "@/server/cbt/cbt-import-service";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { jobId } = await context.params;
    const result = await commitImportJobToBank({ teacher: ctx.cbtTeacher, jobId });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}
