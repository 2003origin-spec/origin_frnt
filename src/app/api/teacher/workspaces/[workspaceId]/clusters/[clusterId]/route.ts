/**
 * A single question cluster.
 *
 *   GET    .../clusters/{id}   the cluster with its ordered members
 *   PATCH  .../clusters/{id}   rename / re-describe, or mutate membership via
 *                              `action`: add-questions | remove-question | reorder
 *   DELETE .../clusters/{id}   delete the cluster (never its questions)
 *
 * Membership changes ride on PATCH with an `action` discriminator rather than
 * child routes — the same convention the tests handler uses for `preview` and
 * `fullLength` (the Next-16 phantom-404 incident).
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §4.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { AuthzError } from "@/server/authz";
import {
  addQuestionsToWorkspaceCluster,
  deleteWorkspaceCluster,
  getWorkspaceCluster,
  MAX_CLUSTER_NAME_LENGTH,
  MAX_QUESTIONS_PER_CLUSTER,
  removeQuestionFromWorkspaceCluster,
  renameWorkspaceCluster,
  reorderWorkspaceCluster,
} from "@/server/workspaces/clusters-service";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type ClusterRouteContext = {
  params: Promise<{ workspaceId: string; clusterId: string }>;
};

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    name: z.string().min(1).max(MAX_CLUSTER_NAME_LENGTH).optional(),
    description: z.string().max(2000).nullish(),
  }),
  z.object({
    action: z.literal("add-questions"),
    questionIds: z.array(z.string().min(1)).min(1).max(MAX_QUESTIONS_PER_CLUSTER),
  }),
  z.object({
    action: z.literal("remove-question"),
    questionId: z.string().min(1),
  }),
  z.object({
    action: z.literal("reorder"),
    orderedQuestionIds: z.array(z.string().min(1)).max(MAX_QUESTIONS_PER_CLUSTER),
  }),
]);

export async function GET(request: NextRequest, context: ClusterRouteContext) {
  try {
    requireFeatureEnabled("questionClusters");
    const { workspaceId, clusterId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const cluster = await getWorkspaceCluster(workspaceId, clusterId);
    if (!cluster) throw new AuthzError(404, "Cluster not found.");
    return teacherJson({ cluster });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: ClusterRouteContext) {
  try {
    requireFeatureEnabled("questionClusters");
    const { workspaceId, clusterId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher", "content_manager",
    ]);
    const body = patchSchema.parse(await parseJsonBody(request));
    const requestId = requestIdOf(request);
    const base = { workspaceId, actorUserId: ctx.auth.userId, clusterId, requestId };

    switch (body.action) {
      case "update": {
        const updated = await renameWorkspaceCluster({
          ...base,
          name: body.name,
          description: body.description === undefined ? undefined : body.description,
        });
        return teacherJson({ cluster: updated });
      }
      case "add-questions":
        return teacherJson({
          cluster: await addQuestionsToWorkspaceCluster({ ...base, questionIds: body.questionIds }),
        });
      case "remove-question":
        return teacherJson({
          cluster: await removeQuestionFromWorkspaceCluster({ ...base, questionId: body.questionId }),
        });
      case "reorder":
        return teacherJson({
          cluster: await reorderWorkspaceCluster({ ...base, orderedQuestionIds: body.orderedQuestionIds }),
        });
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: ClusterRouteContext) {
  try {
    requireFeatureEnabled("questionClusters");
    const { workspaceId, clusterId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    await deleteWorkspaceCluster({
      workspaceId,
      actorUserId: ctx.auth.userId,
      clusterId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}
