/**
 * CBT test assembly service. Tests + ordered test_questions, teacher-scoped.
 * Only `ready` tests may be attached to rooms (enforced at configure time in
 * Phase 8). Max score is derived as SUM(marks) over the test's questions.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import type {
  CbtTest,
  CbtTestQuestion,
  CbtTestQuestionInput,
  CbtTestStatus,
  CbtTestWithQuestions,
} from "@/lib/cbt/test-model";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtId } from "./ids";

export type { CbtTest, CbtTestQuestion, CbtTestQuestionInput, CbtTestStatus, CbtTestWithQuestions };

const MAX_QUESTIONS_PER_TEST = 200;

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

function mapTest(row: Record<string, unknown>): CbtTest {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    durationMinutes: Number(row.duration_minutes ?? 0),
    status: (row.status as CbtTestStatus) ?? "draft",
    questionCount: Number(row.question_count ?? 0),
    maxScore: Number(row.max_score ?? 0),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

// Derived columns shared by list/get so questionCount + maxScore stay in sync.
const TEST_SELECT = `
  t.id, t.teacher_id, t.title, t.description, t.duration_minutes, t.status,
  t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM cbt.test_questions tq WHERE tq.test_id = t.id) AS question_count,
  (SELECT COALESCE(SUM(tq.marks), 0) FROM cbt.test_questions tq WHERE tq.test_id = t.id) AS max_score
`;

export async function listCbtTests(teacherId: string): Promise<CbtTest[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${TEST_SELECT} FROM cbt.tests t WHERE t.teacher_id = $1 ORDER BY t.created_at DESC`,
    [teacherId],
  );
  return res.rows.map(mapTest);
}

export async function getCbtTest(teacherId: string, testId: string): Promise<CbtTestWithQuestions | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${TEST_SELECT} FROM cbt.tests t WHERE t.teacher_id = $1 AND t.id = $2`,
    [teacherId, testId],
  );
  if (!res.rows[0]) return null;
  const test = mapTest(res.rows[0]);

  const qres = await pool().query(
    `SELECT tq.position, tq.question_id, tq.marks, tq.negative_marks,
            q.question_type, q.stem, q.subject
       FROM cbt.test_questions tq
       JOIN cbt.questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.position ASC`,
    [testId],
  );
  const questions: CbtTestQuestion[] = qres.rows.map((r) => ({
    position: Number(r.position),
    questionId: String(r.question_id),
    marks: Number(r.marks),
    negativeMarks: Number(r.negative_marks),
    questionType: r.question_type,
    stem: String(r.stem ?? ""),
    subject: r.subject ? String(r.subject) : null,
  }));
  return { ...test, questions };
}

export async function createCbtTest(
  teacherId: string,
  input: { title?: string; description?: string | null; durationMinutes?: number },
): Promise<CbtTest> {
  await ensureCbtSchema();
  const title = (input.title ?? "").trim();
  if (!title) throw cbtError(400, "A test title is required.");
  const duration = Number(input.durationMinutes);
  const durationMinutes = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 60;
  const id = cbtId("cbttest");
  await pool().query(
    `INSERT INTO cbt.tests (id, teacher_id, title, description, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')`,
    [id, teacherId, title, input.description?.trim() || null, durationMinutes],
  );
  const created = await getCbtTestMeta(teacherId, id);
  if (!created) throw cbtError(500, "Failed to create test.");
  return created;
}

export async function updateCbtTest(
  teacherId: string,
  testId: string,
  input: { title?: string; description?: string | null; durationMinutes?: number; status?: CbtTestStatus },
): Promise<CbtTest | null> {
  await ensureCbtSchema();

  if (input.status === "ready") {
    const count = await pool().query(
      `SELECT COUNT(*)::int AS n FROM cbt.test_questions WHERE test_id = $1`,
      [testId],
    );
    if ((count.rows[0]?.n ?? 0) === 0) {
      throw cbtError(400, "Add at least one question before marking the test ready.");
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [teacherId, testId];
  let i = 3;
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw cbtError(400, "A test title is required.");
    sets.push(`title = $${i++}`);
    values.push(title);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${i++}`);
    values.push(input.description?.trim() || null);
  }
  if (input.durationMinutes !== undefined) {
    const d = Number(input.durationMinutes);
    if (!Number.isFinite(d) || d <= 0) throw cbtError(400, "Duration must be a positive number of minutes.");
    sets.push(`duration_minutes = $${i++}`);
    values.push(Math.floor(d));
  }
  if (input.status !== undefined) {
    if (!["draft", "ready", "archived"].includes(input.status)) throw cbtError(400, "Invalid status.");
    sets.push(`status = $${i++}`);
    values.push(input.status);
  }
  if (sets.length === 0) return getCbtTestMeta(teacherId, testId);

  const res = await pool().query(
    `UPDATE cbt.tests t SET ${sets.join(", ")}, updated_at = NOW()
       WHERE t.teacher_id = $1 AND t.id = $2
     RETURNING t.id`,
    values,
  );
  if (!res.rows[0]) return null;
  return getCbtTestMeta(teacherId, testId);
}

async function getCbtTestMeta(teacherId: string, testId: string): Promise<CbtTest | null> {
  const res = await pool().query(
    `SELECT ${TEST_SELECT} FROM cbt.tests t WHERE t.teacher_id = $1 AND t.id = $2`,
    [teacherId, testId],
  );
  return res.rows[0] ? mapTest(res.rows[0]) : null;
}

export async function deleteCbtTest(teacherId: string, testId: string): Promise<boolean> {
  await ensureCbtSchema();
  const res = await pool().query(`DELETE FROM cbt.tests WHERE teacher_id = $1 AND id = $2`, [teacherId, testId]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Replaces the test's full ordered question list. Positions are the array
 * order. Validates that the test AND every question belong to the teacher.
 */
/** Question ids already used by *other* tests of this teacher (excludes excludeTestId). */
export async function listQuestionIdsUsedInOtherTests(
  teacherId: string,
  excludeTestId: string,
): Promise<string[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT DISTINCT tq.question_id
       FROM cbt.test_questions tq
       JOIN cbt.tests t ON t.id = tq.test_id
      WHERE t.teacher_id = $1 AND tq.test_id <> $2`,
    [teacherId, excludeTestId],
  );
  return res.rows.map((r) => String(r.question_id));
}

export async function setTestQuestions(
  teacherId: string,
  testId: string,
  items: CbtTestQuestionInput[],
): Promise<CbtTestWithQuestions> {
  await ensureCbtSchema();
  if (items.length > MAX_QUESTIONS_PER_TEST) {
    throw cbtError(400, `A test can have at most ${MAX_QUESTIONS_PER_TEST} questions.`);
  }

  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");

    const owns = await client.query(`SELECT id FROM cbt.tests WHERE teacher_id = $1 AND id = $2 FOR UPDATE`, [
      teacherId,
      testId,
    ]);
    if (!owns.rows[0]) {
      throw cbtError(404, "Test not found.");
    }

    const ids = items.map((it) => it.questionId);
    if (ids.length > 0) {
      const owned = await client.query(
        `SELECT id FROM cbt.questions WHERE teacher_id = $1 AND id = ANY($2::text[])`,
        [teacherId, ids],
      );
      const ownedSet = new Set(owned.rows.map((r) => String(r.id)));
      const missing = ids.filter((id) => !ownedSet.has(id));
      if (missing.length > 0 || new Set(ids).size !== ids.length) {
        throw cbtError(400, "One or more questions are invalid or duplicated.");
      }

      // Hard-block (design decision D2): a question may live in at most one test,
      // so no two tests ever share questions. Reject if any incoming question is
      // already used by a different test of this teacher.
      const clash = await client.query(
        `SELECT t.title
           FROM cbt.test_questions tq
           JOIN cbt.tests t ON t.id = tq.test_id
          WHERE t.teacher_id = $1 AND tq.test_id <> $2 AND tq.question_id = ANY($3::text[])
          LIMIT 1`,
        [teacherId, testId, ids],
      );
      if (clash.rows[0]) {
        throw cbtError(
          409,
          `One or more questions are already used in test “${String(clash.rows[0].title)}”. A question can only belong to one test.`,
        );
      }
    }

    await client.query(`DELETE FROM cbt.test_questions WHERE test_id = $1`, [testId]);
    for (let pos = 0; pos < items.length; pos++) {
      const it = items[pos];
      // Default positive marks to +4 when unset/blank/0 — a 0-mark question is
      // never intentional and was surfacing as "+0 / -0" in the player. A teacher
      // who sets an explicit positive value keeps it. Negative marks are kept
      // as-sent INCLUDING 0, because "no negative marking" is a valid choice
      // (only fall back to -1 when the value is missing/non-numeric).
      const rawMarks = Number(it.marks);
      const marks = Number.isFinite(rawMarks) && rawMarks > 0 ? rawMarks : 4;
      const rawNeg = Number(it.negativeMarks);
      const neg = Number.isFinite(rawNeg) ? rawNeg : -1;
      await client.query(
        `INSERT INTO cbt.test_questions (test_id, position, question_id, marks, negative_marks)
           VALUES ($1, $2, $3, $4, $5)`,
        [testId, pos, it.questionId, marks, neg],
      );
    }

    await client.query(`UPDATE cbt.tests SET updated_at = NOW() WHERE id = $1`, [testId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const updated = await getCbtTest(teacherId, testId);
  if (!updated) throw cbtError(404, "Test not found.");
  return updated;
}
