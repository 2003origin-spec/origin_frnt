/**
 * CBT question bank service. Single table cbt.questions (no versioning). Every
 * query is scoped by teacher_id (the cbt.teachers.id tenant key). Per-type
 * validation mirrors createTeacherQuestion; the answer fields are consolidated
 * into one `answer` JSONB column.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  CBT_QUESTION_TYPES,
  type CbtQuestion,
  type CbtQuestionAnswer,
  type CbtQuestionInput,
  type CbtQuestionOption,
  type CbtQuestionSource,
  type CbtQuestionType,
} from "@/lib/cbt/question-model";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtId } from "./ids";

// Re-export the client-safe model so server routes can import everything from
// the service module.
export {
  CBT_QUESTION_TYPES,
  type CbtQuestion,
  type CbtQuestionAnswer,
  type CbtQuestionInput,
  type CbtQuestionOption,
  type CbtQuestionSource,
  type CbtQuestionType,
};

const COLUMNS = `id, teacher_id, question_type, stem, options, answer, explanation, subject, chapter, concept, difficulty, source, import_job_id, created_at, updated_at`;

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

function mapQuestion(row: Record<string, unknown>): CbtQuestion {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    questionType: row.question_type as CbtQuestionType,
    stem: String(row.stem ?? ""),
    options: Array.isArray(row.options) ? (row.options as CbtQuestionOption[]) : [],
    answer: (row.answer as CbtQuestionAnswer) ?? {},
    explanation: row.explanation ? String(row.explanation) : null,
    subject: row.subject ? String(row.subject) : null,
    chapter: row.chapter ? String(row.chapter) : null,
    concept: row.concept ? String(row.concept) : null,
    difficulty: row.difficulty ? String(row.difficulty) : null,
    source: row.source === "imported" ? "imported" : "manual",
    importJobId: row.import_job_id ? String(row.import_job_id) : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function normalizeOptions(raw: unknown): CbtQuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => ({ text: String((o as { text?: unknown })?.text ?? "").trim() }))
    .filter((o) => o.text.length > 0);
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validates + normalizes a question by type. Throws a 400 error on invalid
 * input. Returns the persisted-shape options + answer.
 */
function validateQuestion(input: CbtQuestionInput): {
  questionType: CbtQuestionType;
  options: CbtQuestionOption[];
  answer: CbtQuestionAnswer;
} {
  const stem = (input.stem ?? "").trim();
  if (!stem) throw cbtError(400, "Question stem is required.");

  if (!(CBT_QUESTION_TYPES as readonly string[]).includes(input.questionType)) {
    throw cbtError(400, "Invalid question type.");
  }
  const questionType = input.questionType as CbtQuestionType;
  const rawAnswer = (input.answer ?? {}) as CbtQuestionAnswer;
  const options = normalizeOptions(input.options);
  const answer: CbtQuestionAnswer = {};

  switch (questionType) {
    case "mcq": {
      if (options.length < 2) throw cbtError(400, "MCQ needs at least two options.");
      const idx = toFiniteNumber(rawAnswer.correctOption);
      if (idx === null || idx < 0 || idx >= options.length || !Number.isInteger(idx)) {
        throw cbtError(400, "Select the correct option.");
      }
      answer.correctOption = idx;
      break;
    }
    case "msq": {
      if (options.length < 2) throw cbtError(400, "MSQ needs at least two options.");
      const arr = Array.isArray(rawAnswer.correctOptions) ? rawAnswer.correctOptions : [];
      const indices = [...new Set(arr.map((v) => toFiniteNumber(v)).filter((v): v is number => v !== null))];
      if (indices.length === 0 || indices.some((i) => i < 0 || i >= options.length || !Number.isInteger(i))) {
        throw cbtError(400, "Select at least one correct option.");
      }
      answer.correctOptions = indices.sort((a, b) => a - b);
      break;
    }
    case "numerical": {
      const val = toFiniteNumber(rawAnswer.answerText);
      if (val === null) throw cbtError(400, "A numerical answer is required.");
      answer.answerText = String(val);
      const tol = toFiniteNumber(rawAnswer.tolerance);
      answer.tolerance = tol !== null && tol >= 0 ? tol : 0;
      break;
    }
    case "numerical_with_units": {
      const val = toFiniteNumber(rawAnswer.answerText);
      if (val === null) throw cbtError(400, "A numerical answer is required.");
      const units = (rawAnswer.units ?? "").toString().trim();
      if (!units) throw cbtError(400, "Units are required for this question type.");
      answer.answerText = String(val);
      answer.units = units;
      const tol = toFiniteNumber(rawAnswer.tolerance);
      answer.tolerance = tol !== null && tol >= 0 ? tol : 0;
      break;
    }
    case "symbolic_expression":
    case "equation": {
      const text = (rawAnswer.answerText ?? "").toString().trim();
      if (!text) throw cbtError(400, "An answer expression is required.");
      answer.answerText = text;
      break;
    }
    case "matrix_match": {
      if (!rawAnswer.matrixData || typeof rawAnswer.matrixData !== "object") {
        throw cbtError(400, "Matrix-match data is required.");
      }
      answer.matrixData = rawAnswer.matrixData as Record<string, unknown>;
      break;
    }
    case "subjective": {
      // No machine answer; an optional model answer may be stored for reference.
      const text = (rawAnswer.answerText ?? "").toString().trim();
      if (text) answer.answerText = text;
      break;
    }
  }

  return { questionType, options, answer };
}

export async function listCbtQuestions(teacherId: string): Promise<CbtQuestion[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${COLUMNS} FROM cbt.questions WHERE teacher_id = $1 ORDER BY created_at DESC`,
    [teacherId],
  );
  return res.rows.map(mapQuestion);
}

export async function getCbtQuestion(teacherId: string, questionId: string): Promise<CbtQuestion | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${COLUMNS} FROM cbt.questions WHERE teacher_id = $1 AND id = $2`,
    [teacherId, questionId],
  );
  return res.rows[0] ? mapQuestion(res.rows[0]) : null;
}

/** Ids of bank questions that originated from a given import job (teacher-scoped). */
export async function listCbtQuestionIdsByImportJob(teacherId: string, jobId: string): Promise<string[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT id FROM cbt.questions WHERE teacher_id = $1 AND import_job_id = $2 ORDER BY created_at ASC`,
    [teacherId, jobId],
  );
  return res.rows.map((r) => String(r.id));
}

export async function createCbtQuestion(
  teacherId: string,
  input: CbtQuestionInput,
  opts?: { source?: CbtQuestionSource; importJobId?: string | null },
): Promise<CbtQuestion> {
  await ensureCbtSchema();
  const { questionType, options, answer } = validateQuestion(input);
  const source: CbtQuestionSource = opts?.source === "imported" ? "imported" : "manual";
  const res = await pool().query(
    `INSERT INTO cbt.questions
       (id, teacher_id, question_type, stem, options, answer, explanation, subject, chapter, concept, difficulty, source, import_job_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${COLUMNS}`,
    [
      cbtId("cbtq"),
      teacherId,
      questionType,
      input.stem.trim(),
      JSON.stringify(options),
      JSON.stringify(answer),
      input.explanation?.trim() || null,
      input.subject?.trim() || null,
      input.chapter?.trim() || null,
      input.concept?.trim() || null,
      input.difficulty?.trim() || null,
      source,
      opts?.importJobId ?? null,
    ],
  );
  return mapQuestion(res.rows[0]);
}

export async function updateCbtQuestion(
  teacherId: string,
  questionId: string,
  input: CbtQuestionInput,
): Promise<CbtQuestion | null> {
  await ensureCbtSchema();
  const { questionType, options, answer } = validateQuestion(input);
  const res = await pool().query(
    `UPDATE cbt.questions SET
       question_type = $3, stem = $4, options = $5::jsonb, answer = $6::jsonb,
       explanation = $7, subject = $8, chapter = $9, concept = $10, difficulty = $11,
       updated_at = NOW()
     WHERE teacher_id = $1 AND id = $2
     RETURNING ${COLUMNS}`,
    [
      teacherId,
      questionId,
      questionType,
      input.stem.trim(),
      JSON.stringify(options),
      JSON.stringify(answer),
      input.explanation?.trim() || null,
      input.subject?.trim() || null,
      input.chapter?.trim() || null,
      input.concept?.trim() || null,
      input.difficulty?.trim() || null,
    ],
  );
  return res.rows[0] ? mapQuestion(res.rows[0]) : null;
}

export async function deleteCbtQuestion(teacherId: string, questionId: string): Promise<boolean> {
  await ensureCbtSchema();
  try {
    const res = await pool().query(
      `DELETE FROM cbt.questions WHERE teacher_id = $1 AND id = $2`,
      [teacherId, questionId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    // ON DELETE RESTRICT from cbt.test_questions — the question is in use.
    if ((error as { code?: string })?.code === "23503") {
      throw cbtError(409, "This question is used by a test. Remove it from the test first.");
    }
    throw error;
  }
}
