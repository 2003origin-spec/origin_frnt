/**
 * Storage for teacher test → batch DPP shares.
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 2)
 *
 * Everything here runs on the USER pool (assessment.*, app.*). The student's
 * personal DPP row lives in analytics.dpp_plans behind the OGCODE pool and is
 * materialized separately — the two are never joined (see the plan §2.1).
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureTeacherDppSchema } from "./teacher-dpp-schema";
import type {
  TeacherDppQuestionMarks,
  TeacherDppShare,
  TeacherDppShareForStudent,
} from "./types";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * node-postgres parses TIMESTAMPTZ into a JS Date, and `String(date)` yields
 * `"Mon Sep 07 2026 11:53:43 GMT+0530 (India Standard Time)"` — which Postgres
 * cannot parse back ("time zone \"gmt+0530\" not recognized"). `expiresAt` is
 * read here and then written straight back as a TIMESTAMPTZ parameter by the
 * materializer, so it MUST round-trip as ISO 8601.
 */
export function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Reads the per-question marks snapshot. NULL (a share created before scoring
 * existed) stays null so the caller can fall back to the default practice
 * policy rather than silently scoring everything as zero.
 */
export function toQuestionMarks(value: unknown): TeacherDppQuestionMarks[] | null {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;
  if (!Array.isArray(raw)) return null;
  return raw.map((entry) => {
    const row = (entry ?? {}) as { m?: unknown; n?: unknown };
    return { m: Number(row.m) || 0, n: Number(row.n) || 0 };
  });
}

function rowToShare(row: Record<string, unknown>): TeacherDppShare {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    testId: String(row.test_id),
    title: String(row.title),
    subject: String(row.subject),
    summary: (row.summary as string | null) ?? null,
    durationMinutes: Number(row.duration_minutes ?? 0),
    questionIds: toStringArray(row.question_ids),
    questionMarks: toQuestionMarks(row.question_marks),
    teacherDisplayName: String(row.teacher_display_name),
    teacherLogoUrl: (row.teacher_logo_url as string | null) ?? null,
    sharedBy: String(row.shared_by),
    sharedAt: toIsoTimestamp(row.shared_at),
    expiresAt: toIsoTimestamp(row.expires_at),
    revokedAt: row.revoked_at ? toIsoTimestamp(row.revoked_at) : null,
    batchIds: toStringArray(row.batch_ids),
  };
}

export type CreateTeacherDppShareInput = {
  id: string;
  workspaceId: string;
  testId: string;
  title: string;
  subject: string;
  summary: string | null;
  durationMinutes: number;
  questionIds: string[];
  questionMarks: TeacherDppQuestionMarks[];
  teacherDisplayName: string;
  teacherLogoUrl: string | null;
  sharedBy: string;
  expiresAt: string;
  batchIds: string[];
};

export async function insertTeacherDppShare(
  input: CreateTeacherDppShareInput,
): Promise<TeacherDppShare> {
  await ensureTeacherDppSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO assessment.teacher_dpp_shares (
         id, workspace_id, test_id, title, subject, summary, duration_minutes,
         question_ids, teacher_display_name, teacher_logo_url, shared_by, expires_at,
         question_marks
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb)`,
      [
        input.id,
        input.workspaceId,
        input.testId,
        input.title,
        input.subject,
        input.summary,
        input.durationMinutes,
        JSON.stringify(input.questionIds),
        input.teacherDisplayName,
        input.teacherLogoUrl,
        input.sharedBy,
        input.expiresAt,
        JSON.stringify(input.questionMarks),
      ],
    );
    for (const batchId of input.batchIds) {
      await client.query(
        `INSERT INTO assessment.teacher_dpp_share_batches (share_id, batch_id, workspace_id)
         VALUES ($1,$2,$3) ON CONFLICT (share_id, batch_id) DO NOTHING`,
        [input.id, batchId, input.workspaceId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    testId: input.testId,
    title: input.title,
    subject: input.subject,
    summary: input.summary,
    durationMinutes: input.durationMinutes,
    questionIds: input.questionIds,
    questionMarks: input.questionMarks,
    teacherDisplayName: input.teacherDisplayName,
    teacherLogoUrl: input.teacherLogoUrl,
    sharedBy: input.sharedBy,
    sharedAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    revokedAt: null,
    batchIds: input.batchIds,
  };
}

const SHARE_SELECT = `
  SELECT s.*,
         COALESCE(
           (SELECT json_agg(sb.batch_id ORDER BY sb.batch_id)
              FROM assessment.teacher_dpp_share_batches sb
             WHERE sb.share_id = s.id),
           '[]'::json
         ) AS batch_ids
    FROM assessment.teacher_dpp_shares s
`;

export async function listTeacherDppSharesForWorkspace(
  workspaceId: string,
  filter?: { testId?: string; liveOnly?: boolean },
): Promise<TeacherDppShare[]> {
  await ensureTeacherDppSchema();
  const params: unknown[] = [workspaceId];
  let where = `WHERE s.workspace_id = $1`;
  if (filter?.testId) {
    params.push(filter.testId);
    where += ` AND s.test_id = $${params.length}`;
  }
  if (filter?.liveOnly) {
    where += ` AND s.revoked_at IS NULL AND s.expires_at > NOW()`;
  }
  const result = await pool().query(
    `${SHARE_SELECT} ${where} ORDER BY s.shared_at DESC`,
    params,
  );
  return result.rows.map(rowToShare);
}

export async function getTeacherDppShare(
  workspaceId: string,
  shareId: string,
): Promise<TeacherDppShare | null> {
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `${SHARE_SELECT} WHERE s.workspace_id = $1 AND s.id = $2`,
    [workspaceId, shareId],
  );
  return result.rows[0] ? rowToShare(result.rows[0]) : null;
}

/**
 * Batch ids of this test that already have a LIVE share. Drives the duplicate
 * guard (edge case E5): re-sharing to a batch that already has the test as a
 * live DPP is rejected, but re-sharing after expiry is allowed.
 */
export async function listLiveSharedBatchIdsForTest(
  workspaceId: string,
  testId: string,
): Promise<string[]> {
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `SELECT DISTINCT sb.batch_id
       FROM assessment.teacher_dpp_shares s
       JOIN assessment.teacher_dpp_share_batches sb ON sb.share_id = s.id
      WHERE s.workspace_id = $1
        AND s.test_id = $2
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()`,
    [workspaceId, testId],
  );
  return result.rows.map((row) => String(row.batch_id));
}

export async function revokeTeacherDppShareRow(
  workspaceId: string,
  shareId: string,
): Promise<boolean> {
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `UPDATE assessment.teacher_dpp_shares
        SET revoked_at = NOW()
      WHERE workspace_id = $1 AND id = $2 AND revoked_at IS NULL`,
    [workspaceId, shareId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Every share this student is currently eligible for, in ONE query on the USER
 * pool. The three joins ARE the server-side gate — live enrollment in the
 * issuing workspace, active membership of a targeted batch, and an active
 * (non-archived) batch — evaluated fresh on every read, which is what makes a
 * roster change take effect without touching any materialized row.
 *
 * DISTINCT ON collapses a student who is in two of the share's batches down to
 * a single row, so they never see the same DPP twice.
 */
export async function listActiveTeacherDppSharesForStudent(
  studentId: string,
): Promise<TeacherDppShareForStudent[]> {
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `SELECT DISTINCT ON (s.id)
            s.id, s.workspace_id, s.title, s.subject, s.summary,
            s.duration_minutes, s.question_ids, s.question_marks,
            s.teacher_display_name, s.teacher_logo_url, s.expires_at,
            sb.batch_id
       FROM assessment.teacher_dpp_shares s
       JOIN assessment.teacher_dpp_share_batches sb ON sb.share_id = s.id
       JOIN app.batches b
         ON b.id = sb.batch_id
        AND b.status = 'active'
       JOIN app.batch_members bm
         ON bm.batch_id = sb.batch_id
        AND bm.student_id = $1
        AND bm.status = 'active'
       JOIN app.workspace_student_enrollments e
         ON e.workspace_id = s.workspace_id
        AND e.student_id = $1
        AND e.status IN ('active', 'unassigned')
      WHERE s.revoked_at IS NULL
        AND s.expires_at > NOW()
      -- batch_id ASC makes the cohort stamp deterministic for a student who is
      -- in two of the share's batches: they land in exactly one board rather
      -- than being counted twice.
      ORDER BY s.id, sb.batch_id ASC`,
    [studentId],
  );
  return result.rows.map((row) => ({
    shareId: String(row.id),
    workspaceId: String(row.workspace_id),
    batchId: row.batch_id ? String(row.batch_id) : null,
    title: String(row.title),
    subject: String(row.subject),
    summary: (row.summary as string | null) ?? null,
    durationMinutes: Number(row.duration_minutes ?? 0),
    questionIds: toStringArray(row.question_ids),
    questionMarks: toQuestionMarks(row.question_marks),
    teacherDisplayName: String(row.teacher_display_name),
    teacherLogoUrl: (row.teacher_logo_url as string | null) ?? null,
    // MUST be ISO — the materializer writes this straight back as a TIMESTAMPTZ.
    expiresAt: toIsoTimestamp(row.expires_at),
  }));
}

/**
 * Single-share form of the eligibility gate above, for the take/grade/submit
 * paths. A student holding a DPP id from a stale tab, or one they were told
 * about, must not be able to replay it after leaving the batch — so this is
 * re-evaluated server-side on every mutation, not just at list time.
 */
export async function isStudentEligibleForTeacherDppShare(
  shareId: string,
  studentId: string,
): Promise<boolean> {
  if (!shareId || !studentId) return false;
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `SELECT 1
       FROM assessment.teacher_dpp_shares s
       JOIN assessment.teacher_dpp_share_batches sb ON sb.share_id = s.id
       JOIN app.batches b
         ON b.id = sb.batch_id
        AND b.status = 'active'
       JOIN app.batch_members bm
         ON bm.batch_id = sb.batch_id
        AND bm.student_id = $2
        AND bm.status = 'active'
       JOIN app.workspace_student_enrollments e
         ON e.workspace_id = s.workspace_id
        AND e.student_id = $2
        AND e.status IN ('active', 'unassigned')
      WHERE s.id = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1`,
    [shareId, studentId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * The marks snapshot for one share, for scoring a submission. Deliberately a
 * narrow read — the submit path needs the mark scheme and nothing else, and it
 * must work for a share that has since expired (a student mid-attempt when the
 * clock ran out still gets scored on the scheme they sat).
 */
export async function getTeacherDppScoringSnapshot(
  shareId: string,
): Promise<{ questionIds: string[]; questionMarks: TeacherDppQuestionMarks[] | null } | null> {
  if (!shareId) return null;
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `SELECT question_ids, question_marks
       FROM assessment.teacher_dpp_shares WHERE id = $1`,
    [shareId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    questionIds: toStringArray(row.question_ids),
    questionMarks: toQuestionMarks(row.question_marks),
  };
}

/**
 * Sweeper step 1 (USER pool): hard-delete shares that are past their 30 days or
 * were revoked, returning their ids so the analytics half can clean up the
 * materialized plans. The batch links cascade.
 */
export async function deleteExpiredTeacherDppShares(limit: number): Promise<string[]> {
  await ensureTeacherDppSchema();
  const result = await pool().query(
    `DELETE FROM assessment.teacher_dpp_shares
      WHERE id IN (
        SELECT id FROM assessment.teacher_dpp_shares
         WHERE expires_at <= NOW() OR revoked_at IS NOT NULL
         ORDER BY expires_at ASC
         LIMIT $1
      )
      RETURNING id`,
    [Math.max(1, Math.floor(limit))],
  );
  return result.rows.map((row) => String(row.id));
}
