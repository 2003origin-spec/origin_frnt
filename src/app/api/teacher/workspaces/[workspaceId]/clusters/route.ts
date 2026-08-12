/**
 * Question clusters — collection endpoint.
 *
 *   GET  .../clusters            list the workspace's clusters
 *   POST .../clusters            create one (optionally seeded with questions)
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §4.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createWorkspaceCluster,
  listWorkspaceClusters,
  MAX_CLUSTER_NAME_LENGTH,
  MAX_QUESTIONS_PER_CLUSTER,
} from "@/server/workspaces/clusters-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const createSchema = z.object({
  name: z.string().min(1).max(MAX_CLUSTER_NAME_LENGTH),
  description: z.string().max(2000).nullish(),
  questionIds: z.array(z.string().min(1)).max(MAX_QUESTIONS_PER_CLUSTER).optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("questionClusters");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    return teacherJson({ clusters: await listWorkspaceClusters(workspaceId) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("questionClusters");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher", "content_manager",
    ]);
    const parsed = createSchema.parse(await parseJsonBody(request));

    const cluster = await createWorkspaceCluster({
      workspaceId,
      actorUserId: ctx.auth.userId,
      name: parsed.name,
      description: parsed.description ?? null,
      questionIds: parsed.questionIds,
      requestId: requestIdOf(request),
    });
    return teacherJson({ cluster }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
