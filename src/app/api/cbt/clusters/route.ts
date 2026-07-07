/**
 * GET  /api/cbt/clusters  — list the signed-in teacher's clusters (+ counts)
 * POST /api/cbt/clusters  — create a cluster
 *
 * Role-gated to cbt_teacher (middleware) + requireCbtTeacher. Teacher-scoped.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createCluster, listClusters } from "@/server/cbt/cbt-clusters-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const clusters = await listClusters(ctx.cbtTeacherId);
    return teacherJson({ clusters });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await parseJsonBody(request)) as { name?: unknown; description?: unknown };
    const cluster = await createCluster(ctx.cbtTeacherId, { name: body.name, description: body.description });
    return teacherJson({ cluster }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
