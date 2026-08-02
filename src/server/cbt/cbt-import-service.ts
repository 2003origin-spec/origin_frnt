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
import { parseNumericAnswer } from "@/lib/cbt/answer-format";
import {
  stackSources,
  type CbtTestSource,
  type ResolvedSource,
  type StackResult,
} from "@/lib/cbt/source-stack";

import { ensureCbtSchema } from "./cbt-schema";
import {
  createCbtQuestion,
  listCbtQuestionIdsByImportJob,
  type CbtQuestion,
} from "./cbt-questions-service";
import { createCbtTest, MAX_QUESTIONS_PER_TEST, setTestQuestions } from "./cbt-tests-service";
import { addQuestionsToCluster, createCluster, listClusterQuestionIds } from "./cbt-clusters-service";
import type { CbtTeacher } from "./cbt-teachers-service";

/** Guardrail on the picker: enough for a full paper, not an accidental 500. */
const MAX_SOURCES = 30;

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
  /** Small files: bytes uploaded through the server. */
  file?: { buffer: Buffer; fileName: string; mimeType: string };
  /** Large files: already uploaded to R2 by the browser (presigned PUT). */
  r2Object?: { objectKey: string; bucket: string; fileName: string; mimeType: string; sizeBytes?: number };
}): Promise<DocumentImportJob> {
  const workspaceId = await ensureImportWorkspace(input.teacher, input.userId);
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
  if (!input.file) throw new Error("A file or an uploaded R2 object is required.");
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

/** R2 diagram URL stashed by the worker under import question metadata.imageUrl. */
function importImageUrl(iq: ImportJobQuestion): string | null {
  const url = iq.metadata?.imageUrl;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  let questionType = mapImportType(iq);
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
    case "numerical_with_units": {
      // The worker often extracts a "number + unit" answer ("3F", "9.8 m/s^2")
      // for a numerical question. Route it to numerical_with_units (split into
      // number + unit) so it passes CBT validation and grades on the leading
      // number. A purely non-numeric answer becomes an exact-match expression;
      // a missing answer stays numerical for the teacher to fill in.
      const parsed = parseNumericAnswer(iq.answerText);
      if (parsed.kind === "number_unit") {
        questionType = "numerical_with_units";
        answer.answerText = parsed.number;
        answer.units = parsed.unit;
        answer.tolerance = 0;
      } else if (parsed.kind === "number") {
        questionType = "numerical";
        answer.answerText = parsed.number;
        answer.tolerance = 0;
      } else if ((iq.answerText ?? "").trim()) {
        questionType = "symbolic_expression";
        answer.answerText = (iq.answerText ?? "").trim();
      } else {
        questionType = "numerical";
        answer.answerText = "";
        answer.tolerance = 0;
      }
      break;
    }
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
    image: importImageUrl(iq),
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

/**
 * Bulk-commits every already-`accepted` import question (the worker's
 * high-confidence auto-approvals) into cbt.questions. This is the missing path
 * that left auto-accepted questions visible as "reviewed" but never in the bank:
 * only per-question accept published them before. Idempotent — rows already
 * `published` are not returned by the `accepted` filter, so re-running is safe;
 * rows still needing review (`draft`/`review_required`) and `rejected` rows are
 * left untouched for the teacher to handle.
 */
export async function commitImportJobToBank(input: {
  teacher: CbtTeacher;
  jobId: string;
}): Promise<{ published: number; failed: number }> {
  const workspaceId = input.teacher.importWorkspaceId;
  if (!workspaceId) throw cbtError(404, "Import job not found.");
  const job = await getImportJob(workspaceId, input.jobId);
  if (!job) throw cbtError(404, "Import job not found.");

  const accepted = await getJobQuestions(input.jobId, { status: "accepted" });
  let published = 0;
  let failed = 0;
  for (const iq of accepted) {
    try {
      const created = await createCbtQuestion(input.teacher.id, importQuestionToCbtInput(iq), {
        source: "imported",
        importJobId: input.jobId,
      });
      await updateQuestionStatus(input.jobId, iq.id, "published", {
        questionBagQuestionId: created.id,
      });
      published += 1;
    } catch {
      // A question that fails CBT validation (e.g. a numerical mapped without an
      // extracted answer) must not abort the whole batch. Leave it `accepted`
      // (staged) so the teacher can edit + accept it individually.
      failed += 1;
    }
  }
  return { published, failed };
}

/**
 * Builds a ready-to-run test from an import job (mirrors the Origin teacher
 * "create test from import"): commits every accepted question to the bank, groups
 * the job's questions into a new cluster named after the source file (D3), and
 * creates a test seeded with those questions.
 *
 * Every question from the job is included. Reuse across tests is allowed since
 * 2026-08-02, so questions that already appear in another test are no longer
 * silently dropped — building two papers from the same document used to give
 * the second one nothing.
 */
export async function createTestFromImportJob(input: {
  teacher: CbtTeacher;
  jobId: string;
  shuffleQuestions?: boolean;
}): Promise<{ testId: string; clusterId: string; questionsAdded: number }> {
  const data = await getCbtImportJob(input.teacher, input.jobId);
  if (!data) throw cbtError(404, "Import job not found.");
  const title = (data.job.sourceFileName || "Imported test").slice(0, 120);

  await commitImportJobToBank({ teacher: input.teacher, jobId: input.jobId });

  const questionIds = await listCbtQuestionIdsByImportJob(input.teacher.id, input.jobId);
  if (questionIds.length === 0) {
    throw cbtError(400, "No accepted questions to build a test from. Accept some questions first.");
  }

  // Reusable cluster from the import (collections may overlap freely).
  const cluster = await createCluster(input.teacher.id, { name: title });
  await addQuestionsToCluster(input.teacher.id, cluster.id, questionIds);

  const test = await createCbtTest(input.teacher.id, {
    title,
    shuffleQuestions: input.shuffleQuestions === true,
  });
  await setTestQuestions(
    input.teacher.id,
    test.id,
    questionIds.map((questionId) => ({ questionId, marks: 4, negativeMarks: -1 })),
  );

  return { testId: test.id, clusterId: cluster.id, questionsAdded: questionIds.length };
}

/**
 * Builds ONE test out of several documents and/or clusters, stacked in the
 * order the teacher picked them.
 *
 * Each `import_job` source is committed to the bank first, so questions the
 * teacher accepted moments earlier are included. Ordering, de-duplication and
 * per-source marks are decided by the pure `stackSources` helper; this function
 * only resolves ids and persists.
 */
export async function createTestFromSources(input: {
  teacher: CbtTeacher;
  title: string;
  durationMinutes?: number;
  shuffleQuestions?: boolean;
  sources: CbtTestSource[];
}): Promise<{
  testId: string;
  questionsAdded: number;
  perSource: StackResult["perSource"];
}> {
  await ensureCbtSchema();
  const title = input.title.trim();
  if (!title) throw cbtError(400, "A test title is required.");
  if (input.sources.length === 0) throw cbtError(400, "Pick at least one document or cluster.");
  if (input.sources.length > MAX_SOURCES) {
    throw cbtError(400, `You can combine at most ${MAX_SOURCES} sources in one test.`);
  }

  // Resolve every source to its question ids, in the source's own order.
  const resolved: ResolvedSource[] = [];
  for (const source of input.sources) {
    let questionIds: string[] = [];
    if (source.kind === "import_job") {
      // Pull anything still staged into the bank so a just-reviewed document
      // contributes its questions rather than silently adding nothing.
      await commitImportJobToBank({ teacher: input.teacher, jobId: source.id }).catch(() => undefined);
      questionIds = await listCbtQuestionIdsByImportJob(input.teacher.id, source.id);
    } else {
      // Teacher-scoped: a cluster they don't own resolves to nothing rather
      // than leaking its existence.
      questionIds = await listClusterQuestionIds(input.teacher.id, source.id);
    }
    resolved.push({ ...source, questionIds });
  }

  const stacked = stackSources(resolved);
  if (stacked.questions.length === 0) {
    throw cbtError(400, "None of the selected sources have any questions in your bank yet.");
  }
  if (stacked.questions.length > MAX_QUESTIONS_PER_TEST) {
    throw cbtError(
      400,
      `That selection makes ${stacked.questions.length} questions; a test can have at most ${MAX_QUESTIONS_PER_TEST}. Remove a source and try again.`,
    );
  }

  const test = await createCbtTest(input.teacher.id, {
    title,
    durationMinutes: input.durationMinutes,
    shuffleQuestions: input.shuffleQuestions === true,
  });
  await setTestQuestions(
    input.teacher.id,
    test.id,
    stacked.questions.map((q) => ({
      questionId: q.questionId,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
    })),
  );

  return { testId: test.id, questionsAdded: stacked.questions.length, perSource: stacked.perSource };
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
