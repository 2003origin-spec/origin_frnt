/**
 * Contest document import (admin side). Reuses the shared import.* tables + the
 * deployed FastAPI worker UNCHANGED, keyed by a synthetic hidden workspace per
 * admin (mirrors the CBT import-workspace trick — see cbt-import-service.ts).
 *
 * Phase A (this file, initial): job lifecycle only — create/list/get/delete an
 * import job against the admin's synthetic workspace. No question publishing yet
 * (that lands in Phase B: importQuestionToContestInput / publishContestImportQuestion,
 * which fork accepted questions into the OGCode bank via upsertContributedCatalogQuestion).
 *
 * Plan: V1/CONTEST_DOCUMENT_IMPORT_PLAN.md
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  createImportJob,
  deleteImportJobService,
  getJobQuestions,
  getJobWithProgress,
  listWorkspaceImportJobs,
} from "@/server/workspaces/document-import-service";
import { createWorkspaceWithOwner, getWorkspaceById } from "@/server/workspaces/store";
import { dbFindUserById } from "@/server/db-users";
import type {
  DocumentImportJob,
  ImportJobQuestion,
  ImportJobWithProgress,
  ImportSourceType,
} from "@/server/workspaces/types";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export function contestImportError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function sourceTypeForMime(mimeType: string, fileName: string): ImportSourceType {
  const mt = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mt.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mt.includes("word") || mt.includes("officedocument") || name.endsWith(".docx")) return "docx";
  if (mt.startsWith("image/")) return "image";
  return "txt";
}

/** The admin's cached synthetic import workspace id, or null if not created yet. */
async function getContestImportWorkspaceId(userId: string): Promise<string | null> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT workspace_id FROM contest.admin_import_workspaces WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return res.rows[0] ? String(res.rows[0].workspace_id) : null;
}

/**
 * Lazily creates (once) the admin's synthetic import workspace + owner
 * membership, caching the id in contest.admin_import_workspaces. The `[CONTEST] `
 * name prefix keeps it out of the admin workspace/collaboration surfaces (same
 * approach as CBT's `[CBT] ` prefix). Per-admin: createImportJob requires the
 * acting admin to own the workspace, so a shared singleton would 403 others.
 */
export async function ensureContestImportWorkspace(userId: string): Promise<string> {
  const cached = await getContestImportWorkspaceId(userId);
  if (cached) {
    const existing = await getWorkspaceById(cached);
    if (existing) return existing.id;
  }
  const user = await dbFindUserById(userId).catch(() => null);
  const label = user?.email || userId;
  const ws = await createWorkspaceWithOwner({
    workspaceType: "personal",
    ownerUserId: userId,
    displayName: `[CONTEST] ${label}`,
    settings: { contestSynthetic: true },
  });
  await pool().query(
    `INSERT INTO contest.admin_import_workspaces (user_id, workspace_id, updated_at)
       VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id, updated_at = NOW()`,
    [userId, ws.id],
  );
  return ws.id;
}

export async function createContestImportJob(input: {
  userId: string;
  /** Small files: bytes uploaded through the server. */
  file?: { buffer: Buffer; fileName: string; mimeType: string };
  /** Large files: already uploaded to R2 by the browser (presigned PUT). */
  r2Object?: { objectKey: string; bucket: string; fileName: string; mimeType: string; sizeBytes?: number };
}): Promise<DocumentImportJob> {
  const workspaceId = await ensureContestImportWorkspace(input.userId);
  if (input.r2Object) {
    return createImportJob({
      workspaceId,
      userId: input.userId,
      sourceType: sourceTypeForMime(input.r2Object.mimeType, input.r2Object.fileName),
      fileName: input.r2Object.fileName,
      mimeType: input.r2Object.mimeType,
      targetSurface: "question_bag",
      sourceR2: { objectKey: input.r2Object.objectKey, bucket: input.r2Object.bucket, sizeBytes: input.r2Object.sizeBytes },
      triggerPipeline: true,
    });
  }
  if (!input.file) throw contestImportError(400, "A file or an uploaded R2 object is required.");
  return createImportJob({
    workspaceId,
    userId: input.userId,
    sourceType: sourceTypeForMime(input.file.mimeType, input.file.fileName),
    fileName: input.file.fileName,
    mimeType: input.file.mimeType,
    targetSurface: "question_bag",
    sourceFile: input.file,
    triggerPipeline: true,
  });
}

export async function listContestImportJobs(userId: string): Promise<DocumentImportJob[]> {
  const workspaceId = await getContestImportWorkspaceId(userId);
  if (!workspaceId) return [];
  return listWorkspaceImportJobs(workspaceId, { limit: 50 });
}

export async function getContestImportJob(
  userId: string,
  jobId: string,
): Promise<{ job: ImportJobWithProgress; questions: ImportJobQuestion[] } | null> {
  const workspaceId = await getContestImportWorkspaceId(userId);
  if (!workspaceId) return null;
  const job = await getJobWithProgress(workspaceId, jobId);
  if (!job) return null;
  const questions = await getJobQuestions(jobId, { status: "all" });
  return { job, questions };
}

/**
 * Delete one of this admin's still-active (queued/processing) import jobs, along
 * with its pages, extracted questions, and source file in R2. Addressed through
 * the admin's own synthetic workspace, so a jobId belonging to another admin
 * simply doesn't resolve. Published bank questions are intentionally left alone.
 */
export async function deleteContestImportJob(input: {
  userId: string;
  jobId: string;
  requestId?: string | null;
}): Promise<void> {
  const workspaceId = await getContestImportWorkspaceId(input.userId);
  if (!workspaceId) throw contestImportError(404, "Import job not found.");
  await deleteImportJobService({
    workspaceId,
    jobId: input.jobId,
    actorUserId: input.userId,
    requestId: input.requestId ?? null,
  });
}
