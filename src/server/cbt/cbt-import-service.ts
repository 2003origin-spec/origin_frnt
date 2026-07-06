/**
 * CBT document import. Reuses the existing import.* tables + the deployed
 * FastAPI worker UNCHANGED, keyed by a synthetic hidden workspace per CBT
 * teacher. The worker never touches workspace fields (verified) — it only uses
 * workspace_id as an FK — so isolation holds. Accepted questions are forked
 * into cbt.questions (source='imported'); they never touch content.questions.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  createImportJob,
  getJobQuestions,
  getJobWithProgress,
  listWorkspaceImportJobs,
} from "@/server/workspaces/document-import-service";
import { getImportJob, updateQuestionStatus } from "@/server/workspaces/document-import-store";
import { createWorkspaceWithOwner, getWorkspaceById } from "@/server/workspaces/store";
import type {
  DocumentImportJob,
  ImportJobQuestion,
  ImportJobWithProgress,
  ImportSourceType,
} from "@/server/workspaces/types";
import type { CbtQuestionInput, CbtQuestionType } from "@/lib/cbt/question-model";
import { CBT_QUESTION_TYPES } from "@/lib/cbt/question-model";

import { ensureCbtSchema } from "./cbt-schema";
import { createCbtQuestion, type CbtQuestion } from "./cbt-questions-service";
import type { CbtTeacher } from "./cbt-teachers-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function cbtError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/**
 * Lazily creates (once) the teacher's synthetic import workspace and an owner
 * membership, caching the id on cbt.teachers.import_workspace_id. The `[CBT] `
 * name prefix keeps it out of the admin workspace/collaboration surfaces.
 */
export async function ensureImportWorkspace(teacher: CbtTeacher, userId: string): Promise<string> {
  await ensureCbtSchema();
  if (teacher.importWorkspaceId) {
    const existing = await getWorkspaceById(teacher.importWorkspaceId);
    if (existing) return existing.id;
  }
  const ws = await createWorkspaceWithOwner({
    workspaceType: "personal",
    ownerUserId: userId,
    displayName: `[CBT] ${teacher.email}`,
    settings: { cbtSynthetic: true },
  });
  await pool().query(
    `UPDATE cbt.teachers SET import_workspace_id = $1, updated_at = NOW() WHERE id = $2`,
    [ws.id, teacher.id],
  );
  return ws.id;
}

function sourceTypeForMime(mimeType: string, fileName: string): ImportSourceType {
  const mt = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mt.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mt.includes("word") || mt.includes("officedocument") || name.endsWith(".docx")) return "docx";
  if (mt.startsWith("image/")) return "image";
  return "txt";
}

export async function createCbtImportJob(input: {
  teacher: CbtTeacher;
  userId: string;
  file: { buffer: Buffer; fileName: string; mimeType: string };
}): Promise<DocumentImportJob> {
  const workspaceId = await ensureImportWorkspace(input.teacher, input.userId);
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

export async function listCbtImportJobs(teacher: CbtTeacher): Promise<DocumentImportJob[]> {
  if (!teacher.importWorkspaceId) return [];
  return listWorkspaceImportJobs(teacher.importWorkspaceId, { limit: 50 });
}

export async function getCbtImportJob(
  teacher: CbtTeacher,
  jobId: string,
): Promise<{ job: ImportJobWithProgress; questions: ImportJobQuestion[] } | null> {
  if (!teacher.importWorkspaceId) return null;
  const job = await getJobWithProgress(teacher.importWorkspaceId, jobId);
  if (!job) return null;
  const questions = await getJobQuestions(jobId, { status: "all" });
  return { job, questions };
}

function normalizeImportOptions(options: Record<string, unknown> | null): { text: string }[] {
  if (!options) return [];
  const arr = Array.isArray(options) ? options : Object.values(options);
  return arr
    .map((o) => ({
      text:
        typeof o === "string"
          ? o
          : String((o as { text?: unknown; label?: unknown })?.text ?? (o as { label?: unknown })?.label ?? o ?? ""),
    }))
    .filter((o) => o.text.trim().length > 0);
}

function toIndexArray(value: Record<string, unknown> | null): number[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : Object.values(value);
  return arr.map((v) => Number(v)).filter((n) => Number.isInteger(n));
}

/** Best-effort map from a worker-extracted question to a CBT question type. */
function mapImportType(iq: ImportJobQuestion): CbtQuestionType {
  const t = (iq.questionType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if ((CBT_QUESTION_TYPES as readonly string[]).includes(t)) return t as CbtQuestionType;
  if (t.includes("multiple") || iq.correctOptions) return "msq";
  if (t.includes("single") || t.includes("mcq") || iq.correctOption != null) return "mcq";
  if (t.includes("integer") || t.includes("numeric")) return "numerical";
  if (iq.options && normalizeImportOptions(iq.options).length >= 2) return "mcq";
  return "subjective";
}

/** Maps a worker-extracted question into CBT question input. */
export function importQuestionToCbtInput(iq: ImportJobQuestion): CbtQuestionInput {
  const questionType = mapImportType(iq);
  const options = normalizeImportOptions(iq.options);
  const answer: Record<string, unknown> = {};
  switch (questionType) {
    case "mcq":
      answer.correctOption = iq.correctOption ?? 0;
      break;
    case "msq":
      answer.correctOptions = toIndexArray(iq.correctOptions);
      break;
    case "numerical":
    case "numerical_with_units":
    case "symbolic_expression":
    case "equation":
      answer.answerText = iq.answerText ?? "";
      break;
    case "subjective":
      if (iq.answerText) answer.answerText = iq.answerText;
      break;
  }
  return {
    questionType,
    stem: iq.questionText ?? "",
    options,
    answer,
    explanation: iq.explanation,
    subject: iq.subject,
    chapter: iq.chapter,
    concept: iq.concept,
    difficulty: null,
  };
}

/**
 * Accepts an import question into the CBT bank. `override` lets the teacher
 * inline-edit before accepting. Publishes to cbt.questions (source='imported')
 * and stamps the import row 'published'.
 */
export async function publishImportQuestionToCbt(input: {
  teacher: CbtTeacher;
  jobId: string;
  questionId: string;
  override?: CbtQuestionInput;
}): Promise<CbtQuestion> {
  const workspaceId = input.teacher.importWorkspaceId;
  if (!workspaceId) throw cbtError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw cbtError(404, "Import job not found.");

  const questions = await getJobQuestions(input.jobId, { status: "all" });
  const iq = questions.find((q) => q.id === input.questionId);
  if (!iq) throw cbtError(404, "Import question not found.");

  const cbtInput = input.override ?? importQuestionToCbtInput(iq);
  const created = await createCbtQuestion(input.teacher.id, cbtInput, {
    source: "imported",
    importJobId: input.jobId,
  });
  await updateQuestionStatus(input.jobId, input.questionId, "published", {
    questionBagQuestionId: created.id,
  });
  return created;
}

export async function rejectImportQuestion(input: {
  teacher: CbtTeacher;
  jobId: string;
  questionId: string;
  reason?: string | null;
}): Promise<void> {
  const workspaceId = input.teacher.importWorkspaceId;
  if (!workspaceId) throw cbtError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw cbtError(404, "Import job not found.");
  await updateQuestionStatus(input.jobId, input.questionId, "rejected", {
    rejectionReason: input.reason ?? null,
  });
}
