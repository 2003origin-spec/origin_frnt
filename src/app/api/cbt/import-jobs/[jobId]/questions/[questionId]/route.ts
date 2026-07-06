/**
 * PATCH /api/cbt/import-jobs/[jobId]/questions/[questionId]
 *   body: { action: "accept", question?: CbtQuestionInput }  — publish to bank
 *         { action: "reject", reason? }                       — mark rejected
 *
 * "accept" may carry an edited `question` payload so the teacher can fix an
 * extracted question inline before it lands in the CBT bank.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { publishImportQuestionToCbt, rejectImportQuestion } from "@/server/cbt/cbt-import-service";
import type { CbtQuestionInput } from "@/lib/cbt/question-model";

type RouteContext = { params: Promise<{ jobId: string; questionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { jobId, questionId } = await context.params;
    const body = (await parseJsonBody(request)) as {
      action?: string;
      reason?: string | null;
      question?: CbtQuestionInput;
    };

    if (body.action === "accept") {
      const question = await publishImportQuestionToCbt({
        teacher: ctx.cbtTeacher,
        jobId,
        questionId,
        override: body.question,
      });
      return teacherJson({ question });
    }
    if (body.action === "reject") {
      await rejectImportQuestion({ teacher: ctx.cbtTeacher, jobId, questionId, reason: body.reason });
      return teacherJson({ ok: true });
    }
    return teacherJson({ detail: "Unknown action." }, { status: 400 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
