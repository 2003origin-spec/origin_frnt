/**
 * Assessment store: tests, test_questions, test_assignments, test_attempts, test_answers.
 */

import type { PoolClient } from "pg";

import { canonicalNegativeMarks } from "@/lib/assessments/source-stack";
import { TEST_WINDOW_SUBMIT_GRACE_SECONDS } from "@/lib/assessments/test-window";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureAssessmentSchema } from "./assessment-schema";
import {
  createAssignmentId,
  createAttemptId,
  createTestId,
} from "./ids";
import type {
  AssessmentTest,
  AssignmentStatus,
  AttemptStatus,
  QuestionSourceBank,
  TestAnswer,
  TestAssignment,
  TestAssignmentWithCounts,
  TestAttempt,
  TestQuestion,
  TestSource,
  TestStatus,
  TestWithQuestions,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function isoOrNull(value: unknown): string | null {
  return value ? new Date(value as string).toISOString() : null;
}

function rowToTest(row: Record<string, unknown>): AssessmentTest {
  return {
    id: row.id as string,
    ownerScope: row.owner_scope as "student" | "workspace" | "platform",
    workspaceId: (row.workspace_id as string | null) ?? null,
    createdBy: row.created_by as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    difficulty: row.difficulty as string,
    durationMinutes: Number(row.duration_minutes) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    status: row.status as TestStatus,
    source: row.source as TestSource,
    selectionPolicy: (row.selection_policy as Record<string, unknown>) ?? {},
    scoringPolicy: (row.scoring_policy as Record<string, unknown>) ?? {},
    settings: (row.settings as Record<string, unknown>) ?? {},
    sourceImportJobId: (row.source_import_job_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToTestQuestion(row: Record<string, unknown>): TestQuestion {
  return {
    testId: row.test_id as string,
    position: Number(row.position) || 0,
    sourceBank: row.source_bank as QuestionSourceBank,
    ogcodeQuestionId: (row.ogcode_question_id as string | null) ?? null,
    contentQuestionId: (row.content_question_id as string | null) ?? null,
    contentQuestionVersionId: (row.content_question_version_id as string | null) ?? null,
    marks: Number(row.marks) || 4,
    // `|| -1` would turn a deliberate 0 ("no negative marking") back into -1 and
    // silently reinstate a penalty the teacher removed, so 0 is read as 0.
    negativeMarks: Number.isFinite(Number(row.negative_marks)) ? Number(row.negative_marks) : -1,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function rowToAssignment(row: Record<string, unknown>): TestAssignment {
  return {
    id: row.id as string,
    testId: row.test_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    studentId: (row.student_id as string | null) ?? null,
    scheduledStartAt: row.scheduled_start_at ? new Date(row.scheduled_start_at as string).toISOString() : null,
    scheduledEndAt: row.scheduled_end_at ? new Date(row.scheduled_end_at as string).toISOString() : null,
    status: row.status as AssignmentStatus,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedAt: new Date(row.assigned_at as string).toISOString(),
    settings: (row.settings as Record<string, unknown>) ?? {},
  };
}

function rowToAttempt(row: Record<string, unknown>): TestAttempt {
  return {
    id: row.id as string,
    testId: row.test_id as string,
    assignmentId: (row.assignment_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    roomId: (row.room_id as string | null) ?? null,
    studentId: row.student_id as string,
    attemptNumber: Number(row.attempt_number) || 1,
    status: row.status as AttemptStatus,
    startedAt: new Date(row.started_at as string).toISOString(),
    serverDeadline: row.server_deadline ? new Date(row.server_deadline as string).toISOString() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string).toISOString() : null,
    score: row.score !== null ? Number(row.score) : null,
    totalMarks: Number(row.total_marks) || 0,
    percentage: row.percentage !== null ? Number(row.percentage) : null,
    timeTakenSeconds: row.time_taken_seconds !== null ? Number(row.time_taken_seconds) : null,
    gradingStatus: (row.grading_status as "pending" | "grading" | "completed" | "failed") ?? "pending",
    analyticsStatus: (row.analytics_status as "pending" | "processing" | "completed" | "failed") ?? "pending",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export type CreateTestInput = {
  workspaceId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  subject?: string;
  chapter?: string | null;
  difficulty?: string;
  durationMinutes: number;
  totalQuestions: number;
  status?: TestStatus;
  source?: TestSource;
  selectionPolicy?: Record<string, unknown>;
  scoringPolicy?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  sourceImportJobId?: string | null;
};

export async function createTest(input: CreateTestInput): Promise<AssessmentTest> {
  await ensureAssessmentSchema();
  const id = createTestId();
  const result = await pool().query(
    `INSERT INTO assessment.tests (
       id, owner_scope, workspace_id, created_by, title, description,
       subject, chapter, difficulty, duration_minutes, total_questions,
       status, source, selection_policy, scoring_policy, settings, source_import_job_id
     ) VALUES ($1,'workspace',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.createdBy,
      input.title,
      input.description ?? null,
      input.subject ?? "mixed",
      input.chapter ?? null,
      input.difficulty ?? "medium",
      input.durationMinutes,
      input.totalQuestions,
      input.status ?? "draft",
      input.source ?? "manual",
      JSON.stringify(input.selectionPolicy ?? {}),
      JSON.stringify(input.scoringPolicy ?? {}),
      JSON.stringify(input.settings ?? {}),
      input.sourceImportJobId ?? null,
    ],
  );
  return rowToTest(result.rows[0]);
}

export async function getTestById(testId: string): Promise<AssessmentTest | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.tests WHERE id = $1`,
    [testId],
  );
  return result.rows[0] ? rowToTest(result.rows[0]) : null;
}

export async function getTestWithQuestions(testId: string): Promise<TestWithQuestions | null> {
  await ensureAssessmentSchema();
  const test = await getTestById(testId);
  if (!test) return null;
  const qRows = await pool().query(
    `SELECT * FROM assessment.test_questions
     WHERE test_id = $1
     ORDER BY position ASC`,
    [testId],
  );
  return {
    ...test,
    questions: qRows.rows.map(rowToTestQuestion),
  };
}

export async function listTests(
  workspaceId: string,
  filter?: { status?: TestStatus | "all" },
): Promise<AssessmentTest[]> {
  await ensureAssessmentSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM assessment.tests
     WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToTest);
}

export async function updateTest(
  testId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    subject: string;
    chapter: string | null;
    difficulty: string;
    durationMinutes: number;
    totalQuestions: number;
    status: TestStatus;
    selectionPolicy: Record<string, unknown>;
    scoringPolicy: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>,
): Promise<AssessmentTest | null> {
  await ensureAssessmentSchema();
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    title: "title",
    description: "description",
    subject: "subject",
    chapter: "chapter",
    difficulty: "difficulty",
    durationMinutes: "duration_minutes",
    totalQuestions: "total_questions",
    status: "status",
    selectionPolicy: "selection_policy",
    scoringPolicy: "scoring_policy",
    settings: "settings",
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (["selectionPolicy", "scoringPolicy", "settings"].includes(key)) {
      fields.push(`${map[key]} = $${i++}::jsonb`);
      params.push(JSON.stringify(value));
    } else {
      fields.push(`${map[key]} = $${i++}`);
      params.push(value);
    }
  }
  if (fields.length === 0) return getTestById(testId);
  fields.push("updated_at = NOW()");
  params.push(testId);
  const result = await pool().query(
    `UPDATE assessment.tests
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );
  return result.rows[0] ? rowToTest(result.rows[0]) : null;
}

// ─── Test Questions ────────────────────────────────────────────────────────

export async function addQuestionToTest(input: {
  testId: string;
  position: number;
  sourceBank: QuestionSourceBank;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  contentQuestionVersionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  metadata?: Record<string, unknown>;
}): Promise<TestQuestion> {
  await ensureAssessmentSchema();
  await pool().query(
    `INSERT INTO assessment.test_questions (
       test_id, position, source_bank, ogcode_question_id,
       content_question_id, content_question_version_id, marks, negative_marks, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (test_id, position) DO UPDATE
       SET source_bank = EXCLUDED.source_bank,
           ogcode_question_id = EXCLUDED.ogcode_question_id,
           content_question_id = EXCLUDED.content_question_id,
           content_question_version_id = EXCLUDED.content_question_version_id,
           marks = EXCLUDED.marks,
           negative_marks = EXCLUDED.negative_marks,
           metadata = EXCLUDED.metadata`,
    [
      input.testId,
      input.position,
      input.sourceBank,
      input.ogcodeQuestionId ?? null,
      input.contentQuestionId ?? null,
      input.contentQuestionVersionId ?? null,
      input.marks ?? 4,
      // Single canonical sign for every writer (wizard, dialog, source stack,
      // importer). A positive value here used to AWARD marks for a wrong answer
      // in a shared DPP — see canonicalNegativeMarks.
      canonicalNegativeMarks(input.negativeMarks ?? -1),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const result = await pool().query(
    `SELECT * FROM assessment.test_questions WHERE test_id = $1 AND position = $2`,
    [input.testId, input.position],
  );
  return rowToTestQuestion(result.rows[0]);
}

export type AddTestQuestionInput = {
  position: number;
  sourceBank: QuestionSourceBank;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  contentQuestionVersionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Write a whole question set in ONE statement.
 *
 * Semantically identical to calling {@link addQuestionToTest} per row (same
 * upsert, same canonical negative-marks rule), but a generated full-length paper
 * is up to 180 questions and one round trip each spends the entire creation
 * budget on network latency. UNNEST keeps the statement a fixed size no matter
 * how long the paper is.
 */
export async function addQuestionsToTest(
  testId: string,
  questions: readonly AddTestQuestionInput[],
): Promise<void> {
  if (questions.length === 0) return;
  await ensureAssessmentSchema();
  await insertTestQuestions(pool(), testId, questions);
}

type Queryable = Pick<PoolClient, "query">;

async function insertTestQuestions(
  db: Queryable,
  testId: string,
  questions: readonly AddTestQuestionInput[],
): Promise<void> {
  if (questions.length === 0) return;
  await db.query(
    `INSERT INTO assessment.test_questions (
       test_id, position, source_bank, ogcode_question_id,
       content_question_id, content_question_version_id, marks, negative_marks, metadata
     )
     SELECT $1, q.position, q.source_bank::assessment.question_source_bank, q.ogcode_question_id,
            q.content_question_id, q.content_question_version_id, q.marks, q.negative_marks, q.metadata::jsonb
     FROM UNNEST(
       $2::int[], $3::text[], $4::text[], $5::text[], $6::text[],
       $7::double precision[], $8::double precision[], $9::text[]
     ) AS q(position, source_bank, ogcode_question_id, content_question_id,
            content_question_version_id, marks, negative_marks, metadata)
     ON CONFLICT (test_id, position) DO UPDATE
       SET source_bank = EXCLUDED.source_bank,
           ogcode_question_id = EXCLUDED.ogcode_question_id,
           content_question_id = EXCLUDED.content_question_id,
           content_question_version_id = EXCLUDED.content_question_version_id,
           marks = EXCLUDED.marks,
           negative_marks = EXCLUDED.negative_marks,
           metadata = EXCLUDED.metadata`,
    [
      testId,
      questions.map((q) => q.position),
      questions.map((q) => q.sourceBank),
      questions.map((q) => q.ogcodeQuestionId ?? null),
      questions.map((q) => q.contentQuestionId ?? null),
      questions.map((q) => q.contentQuestionVersionId ?? null),
      questions.map((q) => q.marks ?? 4),
      // Same canonical sign rule as the single-row writer — a positive value
      // here would AWARD marks for a wrong answer.
      questions.map((q) => canonicalNegativeMarks(q.negativeMarks ?? -1)),
      questions.map((q) => JSON.stringify(q.metadata ?? {})),
    ],
  );
}

/** In-progress = status in_progress and the deadline (if any) not yet passed. */
const IN_PROGRESS_ATTEMPT = `status = 'in_progress' AND (server_deadline IS NULL OR server_deadline > NOW())`;

/**
 * Replaces a test's whole question set atomically: clear + insert + the
 * `total_questions` mirror in ONE transaction, so a failed insert can never leave
 * a test with zero questions. Locks the test row FOR UPDATE (attempt starts take
 * FOR SHARE, see {@link recordTeacherTestAttemptStart}) and calls `guard` with
 * the in-progress attempt count under that lock; a throw from `guard` rolls back.
 */
export async function replaceTestQuestions(
  testId: string,
  questions: readonly AddTestQuestionInput[],
  guard?: (state: { inProgressAttemptCount: number }) => void,
): Promise<void> {
  await ensureAssessmentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(`SELECT id FROM assessment.tests WHERE id = $1 FOR UPDATE`, [testId]);
    if (!locked.rows[0]) throw new Error("Test not found.");
    const inProgress = await client.query(
      `SELECT COUNT(*)::int AS n FROM assessment.test_attempts WHERE test_id = $1 AND ${IN_PROGRESS_ATTEMPT}`,
      [testId],
    );
    guard?.({ inProgressAttemptCount: Number(inProgress.rows[0]?.n) || 0 });
    await client.query(`DELETE FROM assessment.test_questions WHERE test_id = $1`, [testId]);
    await insertTestQuestions(client, testId, questions);
    await client.query(
      `UPDATE assessment.tests SET total_questions = $2, updated_at = NOW() WHERE id = $1`,
      [testId, questions.length],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * What the lifecycle guards need to know about a test, from the assessment
 * schema (USER pool): its status, its attempts that hold student work
 * (submitted or with an answer), how many sittings are in progress,
 * whether any active assignment's window is open now (null bounds unbounded),
 * and its question count. Persisted results (analytics.test_results, OGCODE
 * pool) are counted separately by the caller.
 */
export async function getTestAssessmentActivity(testId: string): Promise<{
  status: TestStatus;
  attemptCount: number;
  inProgressAttemptCount: number;
  hasOpenWindow: boolean;
  questionCount: number;
} | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT t.status,
            -- Only sittings that hold student work: a student who merely opened
            -- the paper (an in-progress or timed-out row with no answers) must
            -- not freeze the test forever.
            (SELECT COUNT(*)::int FROM assessment.test_attempts x
              WHERE x.test_id = t.id
                AND (x.submitted_at IS NOT NULL
                     OR x.status IN ('submitted', 'force_submitted', 'needs_review')
                     OR EXISTS (SELECT 1 FROM assessment.test_answers ans WHERE ans.attempt_id = x.id))
            ) AS attempt_count,
            (SELECT COUNT(*)::int FROM assessment.test_attempts x
              WHERE x.test_id = t.id AND ${IN_PROGRESS_ATTEMPT}) AS in_progress_count,
            EXISTS (
              SELECT 1 FROM assessment.test_assignments a
               WHERE a.test_id = t.id AND a.status IN ('assigned', 'open')
                 AND (a.scheduled_start_at IS NULL OR a.scheduled_start_at <= NOW())
                 AND (a.scheduled_end_at IS NULL OR a.scheduled_end_at >= NOW())
            ) AS has_open_window,
            (SELECT COUNT(*)::int FROM assessment.test_questions q WHERE q.test_id = t.id) AS question_count
       FROM assessment.tests t
      WHERE t.id = $1`,
    [testId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    status: row.status as TestStatus,
    attemptCount: Number(row.attempt_count) || 0,
    inProgressAttemptCount: Number(row.in_progress_count) || 0,
    hasOpenWindow: Boolean(row.has_open_window),
    questionCount: Number(row.question_count) || 0,
  };
}

export async function listTestQuestions(testId: string): Promise<TestQuestion[]> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_questions WHERE test_id = $1 ORDER BY position ASC`,
    [testId],
  );
  return result.rows.map(rowToTestQuestion);
}

// ─── Test Assignments ───────────────────────────────────────────────────────

export type CreateAssignmentInput = {
  testId: string;
  workspaceId?: string | null;
  batchId?: string | null;
  studentId?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  assignedBy: string;
};

/**
 * Deletes a test and (via ON DELETE CASCADE) its questions, assignments, attempts
 * and answers. Scoped to the workspace so a teacher can only delete their own tests.
 */
export async function deleteTest(workspaceId: string, testId: string): Promise<boolean> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `DELETE FROM assessment.tests WHERE id = $1 AND workspace_id = $2`,
    [testId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<TestAssignment> {
  await ensureAssessmentSchema();
  const id = createAssignmentId();
  const result = await pool().query(
    `INSERT INTO assessment.test_assignments (
       id, test_id, workspace_id, batch_id, student_id,
       scheduled_start_at, scheduled_end_at, assigned_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      id,
      input.testId,
      input.workspaceId ?? null,
      input.batchId ?? null,
      input.studentId ?? null,
      input.scheduledStartAt ?? null,
      input.scheduledEndAt ?? null,
      input.assignedBy,
    ],
  );
  return rowToAssignment(result.rows[0]);
}

/** What {@link assignTestToBatchOnce} did. */
export type BatchAssignmentOutcome = "created" | "unchanged" | "window_updated";

/**
 * Assigns a test to one batch WITHOUT duplicating an existing assignment (R4-3).
 *
 * Without `replaceWindow` (a save that re-runs Deliver): if the batch already
 * holds an active assignment of this test whose window overlaps the requested
 * one (a null bound is unbounded), no second row is created and the existing
 * window stands; a window that overlaps none (a re-run next week) is a new
 * assignment.
 *
 * With `replaceWindow` (the teacher edited the window on purpose) the batch's
 * existing assignment is UPDATED whether or not the new window overlaps the old
 * one — `assignmentId` names it (the edit page sends the one it pre-filled),
 * else the batch's latest active assignment. Moving a test to non-overlapping
 * dates (postponing it) must not leave the old window open beside the new one.
 * `guard` sees the replacement and the in-progress attempts on that assignment
 * (under the test-row lock attempt starts take FOR SHARE on); a throw rolls
 * back.
 *
 * Serialised per (test, batch) with an advisory lock, so two saves cannot both
 * insert.
 */
export async function assignTestToBatchOnce(input: {
  testId: string;
  workspaceId: string | null;
  batchId: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignedBy: string;
  replaceWindow: boolean;
  /** The assignment the teacher edited (only honoured for this test + batch). */
  assignmentId?: string | null;
  guard?: (state: { before: TestAssignment; inProgressAttemptCount: number }) => void;
}): Promise<{ assignment: TestAssignment; outcome: BatchAssignmentOutcome; before: TestAssignment | null }> {
  await ensureAssessmentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('test_assign:' || $1 || ':' || $2))`, [
      input.testId,
      input.batchId,
    ]);
    const ACTIVE_FOR_BATCH = `test_id = $1 AND batch_id = $2 AND student_id IS NULL AND status IN ('assigned', 'open')`;
    let row: Record<string, unknown> | undefined;
    if (input.replaceWindow) {
      if (input.assignmentId) {
        const named = await client.query(
          `SELECT * FROM assessment.test_assignments WHERE ${ACTIVE_FOR_BATCH} AND id = $3 FOR UPDATE`,
          [input.testId, input.batchId, input.assignmentId],
        );
        row = named.rows[0];
      }
      if (!row) {
        const latest = await client.query(
          `SELECT * FROM assessment.test_assignments WHERE ${ACTIVE_FOR_BATCH}
            ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE`,
          [input.testId, input.batchId],
        );
        row = latest.rows[0];
      }
    } else {
      const overlapping = await client.query(
        `SELECT * FROM assessment.test_assignments
          WHERE ${ACTIVE_FOR_BATCH}
            AND (scheduled_start_at IS NULL OR $4::timestamptz IS NULL OR scheduled_start_at <= $4::timestamptz)
            AND (scheduled_end_at IS NULL OR $3::timestamptz IS NULL OR $3::timestamptz <= scheduled_end_at)
          ORDER BY assigned_at DESC
          LIMIT 1
          FOR UPDATE`,
        [input.testId, input.batchId, input.scheduledStartAt, input.scheduledEndAt],
      );
      row = overlapping.rows[0];
    }
    if (!row) {
      const id = createAssignmentId();
      const inserted = await client.query(
        `INSERT INTO assessment.test_assignments (
           id, test_id, workspace_id, batch_id, student_id,
           scheduled_start_at, scheduled_end_at, assigned_by
         ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7)
         RETURNING *`,
        [
          id,
          input.testId,
          input.workspaceId,
          input.batchId,
          input.scheduledStartAt,
          input.scheduledEndAt,
          input.assignedBy,
        ],
      );
      await client.query("COMMIT");
      return { assignment: rowToAssignment(inserted.rows[0]), outcome: "created", before: null };
    }
    const before = rowToAssignment(row);
    const sameWindow =
      sameInstant(before.scheduledStartAt, input.scheduledStartAt) &&
      sameInstant(before.scheduledEndAt, input.scheduledEndAt);
    if (sameWindow || !input.replaceWindow) {
      await client.query("COMMIT");
      return { assignment: before, outcome: "unchanged", before };
    }
    // Serialise with attempt starts (they take FOR SHARE on the test row), so a
    // sitting that opens while this runs is either counted here or starts
    // under the new window.
    await client.query(`SELECT 1 FROM assessment.tests WHERE id = $1 FOR UPDATE`, [input.testId]);
    // In progress = the stored deadline is ahead, OR an unsubmitted sitting
    // that the window gate would still accept a submit for (started inside
    // this window, NOW within its end + grace — see `windowAttempt`).
    const inProgress = await client.query(
      `SELECT COUNT(*)::int AS n FROM assessment.test_attempts
        WHERE test_id = $1 AND (assignment_id = $2 OR (assignment_id IS NULL AND batch_id = $3))
          AND submitted_at IS NULL
          AND (
            (${IN_PROGRESS_ATTEMPT})
            OR (status IN ('in_progress', 'timed_out')
                AND ($4::timestamptz IS NULL OR started_at >= $4::timestamptz)
                AND $5::timestamptz IS NOT NULL
                AND NOW() <= $5::timestamptz + make_interval(secs => $6::int))
          )`,
      [
        input.testId,
        before.id,
        input.batchId,
        before.scheduledStartAt,
        before.scheduledEndAt,
        TEST_WINDOW_SUBMIT_GRACE_SECONDS,
      ],
    );
    input.guard?.({ before, inProgressAttemptCount: Number(inProgress.rows[0]?.n) || 0 });
    const updated = await client.query(
      `UPDATE assessment.test_assignments
          SET scheduled_start_at = $2, scheduled_end_at = $3
        WHERE id = $1
        RETURNING *`,
      [before.id, input.scheduledStartAt, input.scheduledEndAt],
    );
    await client.query("COMMIT");
    return { assignment: rowToAssignment(updated.rows[0]), outcome: "window_updated", before };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

export async function listTestAssignments(
  testId: string,
): Promise<TestAssignmentWithCounts[]> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT a.*, b.name AS batch_name,
            COALESCE(COUNT(DISTINCT bm.student_id) FILTER (WHERE bm.status = 'active'), 0)::int AS student_count
     FROM assessment.test_assignments a
     LEFT JOIN app.batches b ON b.id = a.batch_id
     LEFT JOIN app.batch_members bm ON bm.batch_id = a.batch_id
     WHERE a.test_id = $1
     GROUP BY a.id, b.name
     ORDER BY a.assigned_at DESC`,
    [testId],
  );
  return result.rows.map((row) => ({
    ...rowToAssignment(row),
    batchName: (row.batch_name as string | null) ?? null,
    studentCount: Number(row.student_count) || 0,
  }));
}

export async function getStudentAssignment(
  studentId: string,
  testId: string,
): Promise<TestAssignment | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_assignments
     WHERE test_id = $1 AND student_id = $2
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [testId, studentId],
  );
  return result.rows[0] ? rowToAssignment(result.rows[0]) : null;
}

// ─── Phase 14: teacher tests → student visibility ─────────────────────────────

/** A teacher-assigned test surfaced to an enrolled student, with cohort context. */
export type AssignedTestForStudent = {
  test: AssessmentTest;
  assignmentId: string;
  workspaceId: string | null;
  batchId: string | null;
  /** Assignment window (null bound = unbounded). Enforced by the legacy taker. */
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  /** The database clock at read time — the ONLY clock the window gate uses. */
  serverNow: string;
  /**
   * The student's current in-progress attempt (assessment.test_attempts) whose
   * deadline has not passed, or null. Its `startedAt` decides whether a submit
   * just after the window closes still earns the grace.
   */
  activeAttempt: { id: string; startedAt: string } | null;
  /**
   * The sitting the window gate judges: the student's latest unsubmitted
   * attempt that is either still active (as {@link activeAttempt}) or belongs to
   * an assignment whose window ended no more than the submit grace ago —
   * WHATEVER its stored `server_deadline`. That deadline counts from page load,
   * the client timer from Start, so a student who read the instructions for a
   * few minutes can hold an expired row while their capped auto-submit is still
   * legitimately in flight at the bell (R4-1). Its `startedAt` decides the grace
   * and a submit closes it. `attemptEndsAt` is when the server expects the
   * sitting to end (`server_deadline` − grace), set only once the student has
   * pressed Start ({@link beginTeacherTestAttempt}); before that it is null.
   */
  windowAttempt: { id: string; startedAt: string; attemptEndsAt: string | null } | null;
  /**
   * Ordered question ids backing the test, in position order: the ogcode id for
   * `ogcode` rows and the content-question id for `workspace_bag` rows. The legacy
   * taker resolves each via the store → ogcode → content lookup chain.
   */
  orderedQuestionIds: string[];
  /**
   * Per-question marks the TEACHER set, positionally aligned with
   * `orderedQuestionIds`. Replayed as grader policy overrides so a teacher's
   * paper grades on their mark scheme (and, for a generated full-length paper,
   * on the real exam's sectional marking) rather than the flat platform default.
   * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md Phase 7.
   */
  orderedQuestionMarking: TeacherTestQuestionMarking[];
};

/** One question's marks + blueprint section inside a teacher test. */
export type TeacherTestQuestionMarking = {
  questionId: string;
  sectionId: string | null;
  marks: number;
  negativeMarks: number;
};

/**
 * Ordered question reference ids for a test across ALL source banks (ogcode +
 * workspace_bag), in position order. ogcode rows contribute their
 * `ogcode_question_id`; workspace_bag rows contribute their `content_question_id`.
 */
async function loadOrderedTestQuestions(
  testId: string,
): Promise<{ ids: string[]; marking: TeacherTestQuestionMarking[] }> {
  const res = await pool().query(
    `SELECT source_bank, ogcode_question_id, content_question_id, marks, negative_marks, metadata
       FROM assessment.test_questions
      WHERE test_id = $1
      ORDER BY position ASC`,
    [testId],
  );

  const ids: string[] = [];
  const marking: TeacherTestQuestionMarking[] = [];
  for (const row of res.rows) {
    const id =
      (row.source_bank as string) === "ogcode"
        ? ((row.ogcode_question_id as string | null) ?? null)
        : ((row.content_question_id as string | null) ?? null);
    if (!id) continue;
    ids.push(id);
    const metadata = (row.metadata ?? {}) as { sectionId?: unknown };
    marking.push({
      questionId: id,
      sectionId: typeof metadata.sectionId === "string" ? metadata.sectionId : null,
      marks: Number(row.marks),
      negativeMarks: Number(row.negative_marks),
    });
  }
  return { ids, marking };
}


/**
 * Membership + publication gate. Deliberately has NO time predicate: the list
 * must still show an upcoming test ("opens at …") and an ended one (to reach its
 * result), and the detail/submit paths need the row to tell "not started" /
 * "ended" apart from "not enrolled". The window itself is enforced by the
 * callers in src/legacy/assessments.ts via src/lib/assessments/test-window.ts.
 */
const ASSIGNED_TEST_WHERE = `
  t.status IN ('published', 'live')
  AND a.status IN ('assigned', 'open')
  AND (bm.student_id IS NOT NULL OR a.student_id = $1)
`;

/**
 * When a student reaches one test through several assignments (two batches, or a
 * batch plus a direct assignment), prefer the one whose window is open NOW, then
 * the next upcoming one, then the most recently ended one. Without this the
 * gate could judge the student by an older, closed assignment.
 */
const ASSIGNMENT_PREFERENCE_ORDER = `
  CASE
    WHEN (a.scheduled_start_at IS NULL OR a.scheduled_start_at <= NOW())
     AND (a.scheduled_end_at IS NULL OR a.scheduled_end_at >= NOW()) THEN 0
    WHEN a.scheduled_start_at > NOW() THEN 1
    ELSE 2
  END,
  CASE WHEN a.scheduled_start_at > NOW() THEN a.scheduled_start_at END ASC NULLS LAST,
  a.scheduled_end_at DESC NULLS FIRST
`;

/**
 * A student mid-attempt is judged by the assignment that attempt belongs to:
 * the one recorded on it, else one whose window contains its start. Without
 * this, during the submit grace after assignment A ends, an upcoming re-sit
 * assignment B outranks A and the submit is refused as `test_not_started`.
 * Needs the `att` LATERAL (the student's window attempt, see
 * {@link ATTEMPT_UNDER_WINDOW_LATERAL}) in scope.
 */
/**
 * `att`: the student's latest unsubmitted attempt at `t` that is either active
 * (in progress, deadline not passed — `att.is_active`) or still inside its own
 * assignment's submit grace (started by the window end, NOW ≤ end + grace),
 * regardless of its stored deadline. Bounded by the window end, so a stale row
 * can never outrank an open re-sit once the grace is over. `$1` = student id,
 * `$3` = grace seconds.
 */
const ATTEMPT_UNDER_WINDOW_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT x.id, x.started_at, x.assignment_id, x.server_deadline,
           (x.metadata ? 'begun_at') AS begun,
           (x.status = 'in_progress' AND (x.server_deadline IS NULL OR x.server_deadline > NOW())) AS is_active
      FROM assessment.test_attempts x
      LEFT JOIN assessment.test_assignments xa ON xa.id = x.assignment_id
     WHERE x.test_id = t.id AND x.student_id = $1 AND x.submitted_at IS NULL
       AND (
         (x.status = 'in_progress' AND (x.server_deadline IS NULL OR x.server_deadline > NOW()))
         OR (x.status IN ('in_progress', 'timed_out')
             AND xa.scheduled_end_at IS NOT NULL
             AND x.started_at <= xa.scheduled_end_at
             AND NOW() <= xa.scheduled_end_at + make_interval(secs => $3::int))
       )
     ORDER BY (x.status = 'in_progress' AND (x.server_deadline IS NULL OR x.server_deadline > NOW())) DESC,
              x.started_at DESC
     LIMIT 1
  ) att ON TRUE
`;

const ACTIVE_ATTEMPT_ASSIGNMENT_FIRST = `
  CASE
    WHEN att.assignment_id IS NOT NULL AND a.id = att.assignment_id THEN 0
    WHEN att.started_at IS NOT NULL
     AND (a.scheduled_start_at IS NULL OR a.scheduled_start_at <= att.started_at)
     AND (a.scheduled_end_at IS NULL OR att.started_at <= a.scheduled_end_at) THEN 1
    ELSE 2
  END
`;

/**
 * Teacher tests visible to a student: published/live tests with an open assignment
 * the student can reach, either via active batch membership OR a direct student
 * assignment. This membership join IS the server-side gate — never trust the list.
 */
export async function listAssignedTestPreviewsForStudent(studentId: string): Promise<
  Array<{
    id: string;
    title: string;
    description: string | null;
    subject: string;
    chapter: string | null;
    difficulty: string;
    durationMinutes: number;
    totalQuestions: number;
    workspaceId: string | null;
    batchId: string | null;
    assignmentId: string;
    windowStartsAt: string | null;
    windowEndsAt: string | null;
  }>
> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT DISTINCT ON (t.id)
            t.id, t.title, t.description, t.subject, t.chapter, t.difficulty,
            t.duration_minutes, t.total_questions, t.workspace_id,
            a.id AS assignment_id, a.batch_id, a.scheduled_start_at, a.scheduled_end_at
       FROM assessment.test_assignments a
       INNER JOIN assessment.tests t ON t.id = a.test_id
       LEFT JOIN app.batch_members bm
         ON bm.batch_id = a.batch_id AND bm.workspace_id = a.workspace_id
        AND bm.status = 'active' AND bm.student_id = $1
      WHERE ${ASSIGNED_TEST_WHERE}
      ORDER BY t.id, ${ASSIGNMENT_PREFERENCE_ORDER}`,
    [studentId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    difficulty: row.difficulty as string,
    durationMinutes: Number(row.duration_minutes) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    assignmentId: row.assignment_id as string,
    windowStartsAt: isoOrNull(row.scheduled_start_at),
    windowEndsAt: isoOrNull(row.scheduled_end_at),
  }));
}

/**
 * Resolves a single teacher-assigned test for a student WITH the same membership
 * gate as the list — returns null when the test is not assigned/reachable. Callers
 * use null + the test's existence to decide between 403 (exists, not a member) and
 * 404 (unknown id). Includes the ordered ogcode question ids backing the test.
 */
export async function getAssignedTestForStudent(
  studentId: string,
  testId: string,
): Promise<AssignedTestForStudent | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT DISTINCT ON (t.id) t.*, a.id AS assignment_id, a.batch_id AS assignment_batch_id,
            a.scheduled_start_at, a.scheduled_end_at, NOW() AS db_now,
            att.id AS att_id, att.started_at AS att_started_at, att.is_active AS att_is_active,
            CASE WHEN att.begun THEN att.server_deadline - make_interval(secs => $3::int) END AS att_ends_at
       FROM assessment.test_assignments a
       INNER JOIN assessment.tests t ON t.id = a.test_id
       LEFT JOIN app.batch_members bm
         ON bm.batch_id = a.batch_id AND bm.workspace_id = a.workspace_id
        AND bm.status = 'active' AND bm.student_id = $1
       ${ATTEMPT_UNDER_WINDOW_LATERAL}
      WHERE t.id = $2 AND ${ASSIGNED_TEST_WHERE}
      ORDER BY t.id, ${ACTIVE_ATTEMPT_ASSIGNMENT_FIRST}, ${ASSIGNMENT_PREFERENCE_ORDER}`,
    [studentId, testId, TEST_WINDOW_SUBMIT_GRACE_SECONDS],
  );
  const row = result.rows[0];
  if (!row) return null;

  const { ids: orderedQuestionIds, marking: orderedQuestionMarking } = await loadOrderedTestQuestions(testId);
  return {
    test: rowToTest(row),
    assignmentId: row.assignment_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: (row.assignment_batch_id as string | null) ?? null,
    windowStartsAt: isoOrNull(row.scheduled_start_at),
    windowEndsAt: isoOrNull(row.scheduled_end_at),
    serverNow: new Date(row.db_now as string).toISOString(),
    activeAttempt:
      row.att_id && row.att_is_active
        ? { id: row.att_id as string, startedAt: new Date(row.att_started_at as string).toISOString() }
        : null,
    windowAttempt: row.att_id
      ? {
          id: row.att_id as string,
          startedAt: new Date(row.att_started_at as string).toISOString(),
          attemptEndsAt: isoOrNull(row.att_ends_at),
        }
      : null,
    orderedQuestionIds,
    orderedQuestionMarking,
  };
}

/**
 * Records that a student was served a teacher test's questions — the attempt's
 * start — in `assessment.test_attempts`, and returns it. Idempotent per sitting:
 * an existing in-progress attempt whose deadline has not passed is reused, so a
 * reload never opens a second attempt. Stale in-progress rows (deadline passed)
 * are closed as `timed_out` first.
 *
 * The deadline is `start + duration`, capped at the window end, plus the submit
 * grace. Past it the attempt no longer counts as in progress, so an abandoned
 * sitting cannot block a teacher's edits forever.
 *
 * Takes a SHARE lock on the test row so it serialises with a question
 * replacement (which takes FOR UPDATE): the attempt is created either before the
 * replacement looks for in-progress attempts, or after it has committed.
 */
export async function recordTeacherTestAttemptStart(input: {
  testId: string;
  studentId: string;
  assignmentId: string | null;
  workspaceId: string | null;
  batchId: string | null;
  durationMinutes: number;
  windowEndsAt: string | null;
  graceSeconds: number;
}): Promise<{ id: string; startedAt: string; created: boolean }> {
  await ensureAssessmentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT 1 FROM assessment.tests WHERE id = $1 FOR SHARE`, [input.testId]);
    await client.query(
      `UPDATE assessment.test_attempts
          SET status = 'timed_out'
        WHERE test_id = $1 AND student_id = $2 AND status = 'in_progress'
          AND server_deadline IS NOT NULL AND server_deadline <= NOW()`,
      [input.testId, input.studentId],
    );
    const active = await client.query(
      `SELECT id, started_at FROM assessment.test_attempts
        WHERE test_id = $1 AND student_id = $2 AND status = 'in_progress'
        ORDER BY started_at DESC
        LIMIT 1`,
      [input.testId, input.studentId],
    );
    if (active.rows[0]) {
      await client.query("COMMIT");
      return {
        id: active.rows[0].id as string,
        startedAt: new Date(active.rows[0].started_at as string).toISOString(),
        created: false,
      };
    }
    const id = createAttemptId();
    const inserted = await client.query(
      `INSERT INTO assessment.test_attempts (
         id, test_id, assignment_id, workspace_id, batch_id, student_id,
         attempt_number, server_deadline
       )
       SELECT $1, $2, $3, $4, $5, $6,
              COALESCE((SELECT MAX(attempt_number) FROM assessment.test_attempts
                         WHERE test_id = $2 AND student_id = $6), 0) + 1,
              LEAST(NOW() + make_interval(mins => $7::int),
                    COALESCE($8::timestamptz, 'infinity'::timestamptz))
                + make_interval(secs => $9::int)
       RETURNING id, started_at`,
      [
        id,
        input.testId,
        input.assignmentId,
        input.workspaceId,
        input.batchId,
        input.studentId,
        Math.max(1, Math.trunc(input.durationMinutes) || 1),
        input.windowEndsAt,
        Math.max(0, Math.trunc(input.graceSeconds)),
      ],
    );
    await client.query("COMMIT");
    return {
      id: inserted.rows[0].id as string,
      startedAt: new Date(inserted.rows[0].started_at as string).toISOString(),
      created: true,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * The student pressed Start. Stamps `metadata.begun_at` (once) and returns when
 * the server expects the sitting to end (`server_deadline` − grace), or null
 * when the attempt is no longer in progress.
 *
 * The clock starts at Start, but no later than page load + a fixed reading
 * allowance (`TEST_INSTRUCTIONS_READING_ALLOWANCE_SECONDS`):
 * `LEAST(LEAST(Start, started_at + allowance) + duration, window end) + grace`.
 * Start is sent by the client, so the allowance bounds how far a modified
 * client could stretch a sitting by delaying it (the paper is served at load);
 * an honest student keeps the instructions-reading time as the real exam UIs
 * do. The window end always caps it, and the taker caps its timer at the
 * returned end, so its auto-submit still lands before the deadline.
 */
/** How long a student may read the instructions before the clock starts anyway. */
export const TEST_INSTRUCTIONS_READING_ALLOWANCE_SECONDS = 10 * 60;

export async function beginTeacherTestAttempt(input: {
  attemptId: string;
  durationMinutes: number;
  windowEndsAt: string | null;
  graceSeconds: number;
}): Promise<{ attemptEndsAt: string | null } | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `UPDATE assessment.test_attempts
        SET server_deadline = CASE WHEN metadata ? 'begun_at' THEN server_deadline
              ELSE LEAST(LEAST(NOW(), started_at + make_interval(secs => $5::int))
                           + make_interval(mins => $2::int),
                         COALESCE($3::timestamptz, 'infinity'::timestamptz))
                   + make_interval(secs => $4::int)
            END,
            metadata = CASE WHEN metadata ? 'begun_at' THEN metadata
              ELSE metadata || jsonb_build_object('begun_at', NOW())
            END
      WHERE id = $1 AND status = 'in_progress' AND submitted_at IS NULL
      RETURNING server_deadline - make_interval(secs => $4::int) AS attempt_ends_at`,
    [
      input.attemptId,
      Math.max(1, Math.trunc(input.durationMinutes) || 1),
      input.windowEndsAt,
      Math.max(0, Math.trunc(input.graceSeconds)),
      TEST_INSTRUCTIONS_READING_ALLOWANCE_SECONDS,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { attemptEndsAt: isoOrNull(row.attempt_ends_at) };
}

/**
 * Closes the student's teacher-test sitting as submitted. A `timed_out` row is
 * closed too: the window gate may accept a submit for an attempt whose stored
 * deadline lapsed (see `windowAttempt`), and that submit must still close it.
 */
export async function markTeacherTestAttemptSubmitted(input: {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTakenSeconds: number;
}): Promise<void> {
  await ensureAssessmentSchema();
  await pool().query(
    `UPDATE assessment.test_attempts
        SET status = 'submitted', submitted_at = NOW(),
            score = $2, total_marks = $3, percentage = $4, time_taken_seconds = $5
      WHERE id = $1 AND status IN ('in_progress', 'timed_out') AND submitted_at IS NULL`,
    [input.attemptId, input.score, input.totalMarks, input.percentage, Math.max(0, Math.trunc(input.timeTakenSeconds))],
  );
}

/**
 * Phase 14 (rooms): resolve a teacher test (assessment.tests) for use inside a
 * study room. Unlike {@link getAssignedTestForStudent} there is NO assignment /
 * batch-membership gate here — room participation is the entitlement, enforced by
 * the caller (the room engine re-checks membership). Returns the test plus its
 * ordered ogcode-bank question ids, or null if the test does not exist. Shaped as
 * an AssignedTestForStudent so the legacy taker can reuse `assignedTeacherTestToRecord`.
 */
export async function getTeacherTestForRoom(testId: string): Promise<AssignedTestForStudent | null> {
  await ensureAssessmentSchema();
  const testResult = await pool().query(`SELECT * FROM assessment.tests WHERE id = $1`, [testId]);
  const row = testResult.rows[0];
  if (!row) return null;

  const { ids: orderedQuestionIds, marking: orderedQuestionMarking } = await loadOrderedTestQuestions(testId);
  return {
    test: rowToTest(row),
    assignmentId: "",
    workspaceId: (row.workspace_id as string | null) ?? null,
    batchId: null,
    windowStartsAt: null,
    windowEndsAt: null,
    serverNow: new Date().toISOString(),
    activeAttempt: null,
    windowAttempt: null,
    orderedQuestionIds,
    orderedQuestionMarking,
  };
}

// ─── Test Attempts ──────────────────────────────────────────────────────────

export async function startAttempt(input: {
  testId: string;
  assignmentId?: string | null;
  workspaceId?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  studentId: string;
  attemptNumber: number;
  serverDeadline?: string | null;
}): Promise<TestAttempt> {
  await ensureAssessmentSchema();
  const id = createAttemptId();
  const result = await pool().query(
    `INSERT INTO assessment.test_attempts (
       id, test_id, assignment_id, workspace_id, batch_id, room_id,
       student_id, attempt_number, server_deadline
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      id,
      input.testId,
      input.assignmentId ?? null,
      input.workspaceId ?? null,
      input.batchId ?? null,
      input.roomId ?? null,
      input.studentId,
      input.attemptNumber,
      input.serverDeadline ?? null,
    ],
  );
  return rowToAttempt(result.rows[0]);
}

export async function submitAttempt(input: {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTakenSeconds: number;
  answers: TestAnswer[];
}): Promise<TestAttempt> {
  await ensureAssessmentSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE assessment.test_attempts
       SET status = 'submitted', submitted_at = NOW(),
           score = $2, total_marks = $3, percentage = $4,
           time_taken_seconds = $5
       WHERE id = $1`,
      [input.attemptId, input.score, input.totalMarks, input.percentage, input.timeTakenSeconds],
    );
    for (const answer of input.answers) {
      await client.query(
        `INSERT INTO assessment.test_answers (
           attempt_id, position, question_snapshot, submitted_answer,
           grading_result, time_spent_seconds, is_marked_for_review
         ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7)
         ON CONFLICT (attempt_id, position) DO UPDATE
           SET submitted_answer = EXCLUDED.submitted_answer,
               grading_result = EXCLUDED.grading_result,
               time_spent_seconds = EXCLUDED.time_spent_seconds,
               is_marked_for_review = EXCLUDED.is_marked_for_review`,
        [
          input.attemptId,
          answer.position,
          JSON.stringify(answer.questionSnapshot),
          JSON.stringify(answer.submittedAnswer),
          JSON.stringify(answer.gradingResult),
          answer.timeSpentSeconds,
          answer.isMarkedForReview,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts WHERE id = $1`,
    [input.attemptId],
  );
  return rowToAttempt(result.rows[0]);
}

export async function getActiveAttempt(
  studentId: string,
  testId: string,
): Promise<TestAttempt | null> {
  await ensureAssessmentSchema();
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts
     WHERE student_id = $1 AND test_id = $2 AND status = 'in_progress'
     LIMIT 1`,
    [studentId, testId],
  );
  return result.rows[0] ? rowToAttempt(result.rows[0]) : null;
}

export async function listAttemptResults(
  testId: string,
  filter?: { batchId?: string },
): Promise<TestAttempt[]> {
  await ensureAssessmentSchema();
  const params: unknown[] = [testId];
  let extra = "";
  if (filter?.batchId) {
    params.push(filter.batchId);
    extra = ` AND batch_id = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM assessment.test_attempts
     WHERE test_id = $1 AND status = 'submitted'${extra}
     ORDER BY score DESC, time_taken_seconds ASC`,
    params,
  );
  return result.rows.map(rowToAttempt);
}
