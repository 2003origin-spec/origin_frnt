/**
 * POST   /api/cbt/clusters/[clusterId]/members  body { questionIds: string[] }
 *   — add questions to a cluster (only the teacher's own are added)
 * DELETE /api/cbt/clusters/[clusterId]/members  body { questionId: string }
 *   — remove one question from a cluster
 *
 * Role-gated to cbt_teacher + requireCbtTeacher. Teacher-scoped.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { addQuestionsToCluster, removeQuestionFromCluster } from "@/server/cbt/cbt-clusters-service";

type RouteContext = { params: Promise<{ clusterId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { clusterId } = await context.params;
    const body = (await parseJsonBody(request)) as { questionIds?: unknown };
    const ids = Array.isArray(body.questionIds) ? body.questionIds.map((v) => String(v)) : [];
    const result = await addQuestionsToCluster(ctx.cbtTeacherId, clusterId, ids);
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { clusterId } = await context.params;
    const body = (await parseJsonBody(request)) as { questionId?: unknown };
    const questionId = String(body.questionId ?? "");
    if (!questionId) return teacherJson({ detail: "questionId is required." }, { status: 400 });
    await removeQuestionFromCluster(ctx.cbtTeacherId, clusterId, questionId);
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
