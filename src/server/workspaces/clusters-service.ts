/**
 * Question clusters — service layer: business rules, permissions and audit.
 *
 * The store is already workspace-scoped in SQL; this layer adds the rules a
 * teacher experiences (name required, caps, "cluster not found" vs silent
 * no-op) and records the audit trail every other workspace mutation records.
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §4.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  addQuestionsToCluster,
  createCluster,
  deleteCluster,
  getCluster,
  listClusterMembers,
  listClusters,
  removeQuestionFromCluster,
  reorderCluster,
  updateCluster,
  type ClusterMember,
  type QuestionCluster,
} from "./clusters-store";

/** How many clusters one workspace may hold. Generous; a guard, not a quota. */
export const MAX_CLUSTERS_PER_WORKSPACE = 200;

/** Ceiling on one cluster, matching the per-test question cap it feeds. */
export const MAX_QUESTIONS_PER_CLUSTER = 200;

export const MAX_CLUSTER_NAME_LENGTH = 120;

export type ClusterWithMembers = QuestionCluster & { members: ClusterMember[] };

function normalizeName(raw: string): string {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw new AuthzError(400, "Give the cluster a name.");
  return name.slice(0, MAX_CLUSTER_NAME_LENGTH);
}

export async function listWorkspaceClusters(workspaceId: string): Promise<QuestionCluster[]> {
  return listClusters(workspaceId);
}

export async function getWorkspaceCluster(
  workspaceId: string,
  clusterId: string,
): Promise<ClusterWithMembers | null> {
  const cluster = await getCluster(workspaceId, clusterId);
  if (!cluster) return null;
  const members = await listClusterMembers(workspaceId, clusterId);
  return { ...cluster, members };
}

export async function createWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  name: string;
  description?: string | null;
  sourceImportJobId?: string | null;
  /** Optional initial members, added in the order given. */
  questionIds?: readonly string[];
  requestId?: string | null;
}): Promise<ClusterWithMembers> {
  const name = normalizeName(input.name);

  const existing = await listClusters(input.workspaceId);
  if (existing.length >= MAX_CLUSTERS_PER_WORKSPACE) {
    throw new AuthzError(
      400,
      `This workspace already has ${MAX_CLUSTERS_PER_WORKSPACE} clusters. Delete one before creating another.`,
    );
  }

  const cluster = await createCluster({
    workspaceId: input.workspaceId,
    name,
    description: input.description ?? null,
    sourceImportJobId: input.sourceImportJobId ?? null,
    createdBy: input.actorUserId,
  });

  if (input.questionIds?.length) {
    await addQuestionsToCluster(
      input.workspaceId,
      cluster.id,
      input.questionIds.slice(0, MAX_QUESTIONS_PER_CLUSTER),
    );
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question_cluster",
    entityId: cluster.id,
    action: "cluster.created",
    after: { id: cluster.id, name: cluster.name, sourceImportJobId: cluster.sourceImportJobId },
    requestId: input.requestId,
  });

  return (await getWorkspaceCluster(input.workspaceId, cluster.id))!;
}

export async function renameWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  clusterId: string;
  name?: string;
  description?: string | null;
  requestId?: string | null;
}): Promise<QuestionCluster> {
  const patch: { name?: string; description?: string | null } = {};
  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.description !== undefined) patch.description = input.description;

  const updated = await updateCluster(input.workspaceId, input.clusterId, patch);
  if (!updated) throw new AuthzError(404, "Cluster not found.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question_cluster",
    entityId: input.clusterId,
    action: "cluster.updated",
    after: { id: updated.id, name: updated.name },
    requestId: input.requestId,
  });
  return updated;
}

export async function deleteWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  clusterId: string;
  requestId?: string | null;
}): Promise<void> {
  const existing = await getCluster(input.workspaceId, input.clusterId);
  if (!existing) throw new AuthzError(404, "Cluster not found.");

  // Questions are never deleted with a cluster — the bag is the system of
  // record and the same question may sit in other clusters and live tests (D8).
  const deleted = await deleteCluster(input.workspaceId, input.clusterId);
  if (!deleted) throw new AuthzError(404, "Cluster not found.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question_cluster",
    entityId: input.clusterId,
    action: "cluster.deleted",
    before: { id: existing.id, name: existing.name, questionCount: existing.questionCount },
    requestId: input.requestId,
  });
}

export async function addQuestionsToWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  clusterId: string;
  questionIds: readonly string[];
  requestId?: string | null;
}): Promise<ClusterWithMembers> {
  const cluster = await getCluster(input.workspaceId, input.clusterId);
  if (!cluster) throw new AuthzError(404, "Cluster not found.");

  const current = await listClusterMembers(input.workspaceId, input.clusterId);
  const room = MAX_QUESTIONS_PER_CLUSTER - current.length;
  if (room <= 0) {
    throw new AuthzError(400, `A cluster can hold at most ${MAX_QUESTIONS_PER_CLUSTER} questions.`);
  }

  const added = await addQuestionsToCluster(
    input.workspaceId,
    input.clusterId,
    input.questionIds.slice(0, room),
  );

  if (added > 0) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "question_cluster",
      entityId: input.clusterId,
      action: "cluster.questions_added",
      after: { clusterId: input.clusterId, added },
      requestId: input.requestId,
    });
  }
  return (await getWorkspaceCluster(input.workspaceId, input.clusterId))!;
}

export async function removeQuestionFromWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  clusterId: string;
  questionId: string;
  requestId?: string | null;
}): Promise<ClusterWithMembers> {
  const removed = await removeQuestionFromCluster(input.workspaceId, input.clusterId, input.questionId);
  if (!removed) throw new AuthzError(404, "That question is not in this cluster.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question_cluster",
    entityId: input.clusterId,
    action: "cluster.question_removed",
    before: { clusterId: input.clusterId, questionId: input.questionId },
    requestId: input.requestId,
  });
  return (await getWorkspaceCluster(input.workspaceId, input.clusterId))!;
}

export async function reorderWorkspaceCluster(input: {
  workspaceId: string;
  actorUserId: string;
  clusterId: string;
  orderedQuestionIds: readonly string[];
  requestId?: string | null;
}): Promise<ClusterWithMembers> {
  const ok = await reorderCluster(input.workspaceId, input.clusterId, input.orderedQuestionIds);
  if (!ok) throw new AuthzError(404, "Cluster not found.");
  return (await getWorkspaceCluster(input.workspaceId, input.clusterId))!;
}
