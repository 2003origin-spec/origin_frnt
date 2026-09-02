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
import { getImportJob, updateQuestionStatus } from "@/server/workspaces/document-import-store";
import { createWorkspaceWithOwner, getWorkspaceById } from "@/server/workspaces/store";
import { dbFindUserById } from "@/server/db-users";
import {
  listContestImportQuestions,
  upsertContributedCatalogQuestion,
  type ContributedCatalogInput,
} from "@/server/ogcode-catalog";
import type { StoredQuestion } from "@/legacy/store";
import { normalizeSubject } from "@/lib/entitlements";
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

// ─── Phase B: map + publish extracted questions into the OGCode bank ──────────
//
// Contest questions live in the shared OGCode bank (ogcode_questions) — that's
// the only source the contest resolver, pre-contest practice, and DPP-from-
// mistakes read. So an accepted import is published there via
// upsertContributedCatalogQuestion, tagged is_contest_import (hidden from general
// OGCode surfaces) and optionally contest_practice_eligible. To be usable in a
// paper/practice/DPP the question MUST be an MCQ with ≥2 options, a correct
// option, a canonical subject, and a chapter — enforced at publish so nothing
// that would fail the `type:"mcq"` pool filter ever lands.

/** Coerce the worker's loose options blob into a bank-shaped string[]. */
function optionTexts(options: Record<string, unknown> | null): string[] {
  if (!options) return [];
  const arr = Array.isArray(options) ? options : Object.values(options);
  return arr
    .map((o) =>
      typeof o === "string"
        ? o
        : String((o as { text?: unknown; label?: unknown })?.text ?? (o as { label?: unknown })?.label ?? o ?? ""),
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** R2 diagram URL stashed by the worker under import question metadata.imageUrl. */
function importImageUrl(iq: ImportJobQuestion): string | null {
  const url = iq.metadata?.imageUrl;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Admin-edited fields sent from the review UI before publishing a question. */
export type ContestImportOverride = {
  text?: string;
  options?: string[];
  correctOption?: number;
  subject?: string;
  chapter?: string;
  concept?: string;
  difficulty?: string;
  explanation?: string;
  hint?: string | null;
  image?: string | null;
  optionImages?: (string | null)[] | null;
};

/** Default MCQ mapping of a worker-extracted question, for the review UI. */
export type ContestQuestionDraft = {
  text: string;
  options: string[];
  correctOption: number;
  subject: string | null;
  chapter: string | null;
  concept: string;
  difficulty: string;
  explanation: string;
  hint: string | null;
  image: string | null;
  optionImages: (string | null)[] | null;
  /** True when the extracted question already satisfies the contest MCQ invariant. */
  mcqEligible: boolean;
};

export function importQuestionToContestInput(iq: ImportJobQuestion): ContestQuestionDraft {
  const options = optionTexts(iq.options);
  const correctOption = typeof iq.correctOption === "number" && iq.correctOption >= 0 ? iq.correctOption : 0;
  const t = (iq.questionType ?? "").toLowerCase();
  const looksMcq = t.includes("mcq") || t.includes("single") || (iq.correctOption != null && !iq.correctOptions);
  const subject = iq.subject ? normalizeSubject(iq.subject) : null;
  return {
    text: iq.questionText ?? "",
    options,
    correctOption: correctOption < options.length ? correctOption : 0,
    subject,
    chapter: iq.chapter,
    concept: iq.concept ?? "",
    difficulty: (iq.difficulty ?? "medium").toLowerCase(),
    explanation: iq.explanation ?? "",
    hint: iq.hint,
    image: importImageUrl(iq),
    optionImages: iq.optionImages ?? null,
    mcqEligible: (looksMcq || options.length >= 2) && options.length >= 2,
  };
}

/** Stable catalog id per import question, so re-publishing upserts in place. */
function contestCatalogId(jobId: string, questionId: string): string {
  return `contest-imp:${jobId}:${questionId}`;
}

/** Build + validate the OGCode-bank row for a contest import question. Throws 400 on invalid. */
function buildContestCatalogInput(args: {
  jobId: string;
  questionId: string;
  draft: ContestQuestionDraft;
  override?: ContestImportOverride;
  practiceEligible: boolean;
  contributorWorkspaceId: string;
}): ContributedCatalogInput {
  const { jobId, questionId, draft, override, practiceEligible, contributorWorkspaceId } = args;
  const text = (override?.text ?? draft.text ?? "").trim();
  const options = (override?.options ?? draft.options ?? []).map((o) => String(o ?? "").trim()).filter((o) => o.length > 0);
  const correctOption = override?.correctOption ?? draft.correctOption ?? 0;
  const rawSubject = override?.subject ?? draft.subject ?? "";
  const subject = normalizeSubject(rawSubject) ?? "";
  const chapter = (override?.chapter ?? draft.chapter ?? "").trim();

  if (!text) throw contestImportError(400, "Question text is required.");
  if (options.length < 2) throw contestImportError(400, "A contest question must be an MCQ with at least two options.");
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
    throw contestImportError(400, "A valid correct option must be selected.");
  }
  if (!subject) throw contestImportError(400, "A valid subject is required for a contest question.");
  if (!chapter) throw contestImportError(400, "A chapter is required so the question is practice/DPP-eligible.");

  return {
    id: contestCatalogId(jobId, questionId),
    text,
    options,
    image: override?.image ?? draft.image ?? null,
    optionImages: override?.optionImages ?? draft.optionImages ?? null,
    correctOption,
    correctOptions: null,
    answerText: null,
    answerSpec: null,
    tolerance: null,
    matrixData: null,
    explanation: (override?.explanation ?? draft.explanation ?? "").trim(),
    hint: override?.hint ?? draft.hint ?? null,
    subject,
    chapter,
    concept: (override?.concept ?? draft.concept ?? "").trim(),
    difficulty: (override?.difficulty ?? draft.difficulty ?? "medium").toLowerCase(),
    questionType: "mcq",
    tags: [],
    contributorWorkspaceId,
    attributionName: null,
    attributionLogoUrl: null,
    isContestImport: true,
    contestPracticeEligible: practiceEligible,
  };
}

/**
 * Publish one accepted/reviewed import question into the OGCode bank as a
 * contest import. `override` carries the admin's inline edits (incl. the chosen
 * chapter/subject); `practiceEligible` is the per-question "send to practice"
 * flag. Idempotent — the stable id upserts in place. Returns the catalog id.
 */
export async function publishContestImportQuestion(input: {
  userId: string;
  jobId: string;
  questionId: string;
  override?: ContestImportOverride;
  practiceEligible?: boolean;
}): Promise<{ catalogId: string }> {
  const workspaceId = await getContestImportWorkspaceId(input.userId);
  if (!workspaceId) throw contestImportError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw contestImportError(404, "Import job not found.");

  const questions = await getJobQuestions(input.jobId, { status: "all" });
  const iq = questions.find((q) => q.id === input.questionId);
  if (!iq) throw contestImportError(404, "Import question not found.");

  const draft = importQuestionToContestInput(iq);
  const catalogInput = buildContestCatalogInput({
    jobId: input.jobId,
    questionId: input.questionId,
    draft,
    override: input.override,
    practiceEligible: input.practiceEligible ?? false,
    contributorWorkspaceId: workspaceId,
  });

  await upsertContributedCatalogQuestion(catalogInput);
  await updateQuestionStatus(input.jobId, input.questionId, "published", {
    questionBagQuestionId: catalogInput.id,
  });
  return { catalogId: catalogInput.id };
}

/** Reject one import question (ownership-checked via the admin's workspace). */
export async function rejectContestImportQuestion(input: {
  userId: string;
  jobId: string;
  questionId: string;
  reason?: string | null;
}): Promise<void> {
  const workspaceId = await getContestImportWorkspaceId(input.userId);
  if (!workspaceId) throw contestImportError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw contestImportError(404, "Import job not found.");
  await updateQuestionStatus(input.jobId, input.questionId, "rejected", {
    rejectionReason: input.reason ?? null,
  });
}

/**
 * Bulk-publish every already-`accepted` import question that satisfies the
 * contest MCQ invariant. Non-MCQ / invalid rows are skipped (left for the admin
 * to fix or delete), never silently dropped into a broken state. `practiceEligible`
 * applies to all committed rows (the review UI's Select-all → commit path).
 * Idempotent: `published` rows aren't returned by the `accepted` filter.
 */
export async function commitContestImportJob(input: {
  userId: string;
  jobId: string;
  practiceEligible?: boolean;
}): Promise<{ published: number; skipped: number; failed: number }> {
  const workspaceId = await getContestImportWorkspaceId(input.userId);
  if (!workspaceId) throw contestImportError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw contestImportError(404, "Import job not found.");

  const accepted = await getJobQuestions(input.jobId, { status: "accepted" });
  let published = 0;
  let skipped = 0;
  let failed = 0;
  for (const iq of accepted) {
    try {
      await publishContestImportQuestion({
        userId: input.userId,
        jobId: input.jobId,
        questionId: iq.id,
        practiceEligible: input.practiceEligible ?? false,
      });
      published += 1;
    } catch (error) {
      // A 400 = not contest-eligible (non-MCQ / missing chapter) → skip, not fail.
      if ((error as { status?: number })?.status === 400) skipped += 1;
      else {
        failed += 1;
        console.error("[contest-import] commit publish failed", { jobId: input.jobId, questionId: iq.id, error });
      }
    }
  }
  return { published, skipped, failed };
}

// ─── Phase E: direct-attach — list the admin's published contest imports ──────

/** The admin's published contest-import questions (for the builder's attach picker). */
export async function listContestImportBankQuestions(userId: string): Promise<StoredQuestion[]> {
  const workspaceId = await getContestImportWorkspaceId(userId);
  if (!workspaceId) return [];
  return listContestImportQuestions(workspaceId);
}
