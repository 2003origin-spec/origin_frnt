/**
 * PATCH  /api/cbt/clusters/[clusterId]  — rename / re-describe a cluster
 * DELETE /api/cbt/clusters/[clusterId]  — delete a cluster (questions untouched)
 *
 * Role-gated to cbt_teacher + requireCbtTeacher. Teacher-scoped: a cluster the
 * teacher does not own is 404.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { deleteCluster, updateCluster } from "@/server/cbt/cbt-clusters-service";

type RouteContext = { params: Promise<{ clusterId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { clusterId } = await context.params;
    const body = (await parseJsonBody(request)) as { name?: unknown; description?: unknown };
    const cluster = await updateCluster(ctx.cbtTeacherId, clusterId, {
      name: body.name,
      description: body.description,
    });
    return teacherJson({ cluster });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { clusterId } = await context.params;
    await deleteCluster(ctx.cbtTeacherId, clusterId);
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
