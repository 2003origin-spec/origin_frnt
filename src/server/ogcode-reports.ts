/**
 * OGCode Report Question (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §11).
 *
 * Store-only in v1: a report inserts/updates one row per (question, student).
 * NO admin/triage UI here — reports accumulate for a later moderation pass
 * (the admin/ogcode/moderation pipeline is the natural future home). Sole
 * owner of ogcode_question_reports.
 *
 * Canonical SQL: src/db/migrations/20260713_ogcode_engagement.sql
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeReportsSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_question_reports (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    reason      TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (question_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS ogcode_question_reports_status_idx ON ogcode_question_reports (status);
`;

/** Accepted report reasons (kept in sync with the client dropdown). */
export const OGCODE_REPORT_REASONS = [
  "incorrect_answer",
  "unclear_question",
  "typo_or_formatting",
  "wrong_options",
  "image_missing",
  "other",
] as const;
export type OgcodeReportReason = (typeof OGCODE_REPORT_REASONS)[number];

export function isOgcodeReportReason(value: string): value is OgcodeReportReason {
  return (OGCODE_REPORT_REASONS as readonly string[]).includes(value);
}

/** Admin triage states for a reported question. */
export const OGCODE_REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
export type OgcodeReportStatus = (typeof OGCODE_REPORT_STATUSES)[number];

export function isOgcodeReportStatus(value: string): value is OgcodeReportStatus {
  return (OGCODE_REPORT_STATUSES as readonly string[]).includes(value);
}

export type OgcodeAdminReport = {
  id: string;
  questionId: string;
  userId: string;
  reason: OgcodeReportReason;
  description: string | null;
  status: OgcodeReportStatus;
  createdAt: string;
  updatedAt: string;
  questionStem: string | null;
  questionSubject: string | null;
  questionDifficulty: string | null;
};

async function ensureReportsSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodeReportsSchemaReady) {
    globalThis.__originOgcodeReportsSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeReportsSchemaReady = undefined;
      throw error;
    });
  }
  await globalThis.__originOgcodeReportsSchemaReady;
}

export function isOgcodeReportsAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

/**
 * Insert or refresh this student's single report for a question. Upsert on the
 * (question_id, user_id) unique key: a re-report updates reason/description/
 * timestamp rather than stacking duplicates or failing. `status` is preserved
 * on conflict — a student re-report never reopens a moderator-resolved row.
 */
export async function submitOgcodeQuestionReport(
  userId: string,
  questionId: string,
  reason: OgcodeReportReason,
  description: string | null,
): Promise<{ ok: boolean }> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { ok: false };
  }
  await ensureReportsSchema();
  const trimmed = (description ?? "").trim().slice(0, 2000) || null;
  await pool.query(
    `
      INSERT INTO ogcode_question_reports (id, question_id, user_id, reason, description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (question_id, user_id) DO UPDATE SET
        reason = EXCLUDED.reason,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
    [`ogr_${crypto.randomUUID()}`, questionId, userId, reason, trimmed],
  );
  return { ok: true };
}

/** Admin: list reported questions (newest first), joined with the question text. */
export async function listOgcodeQuestionReports(
  options: { status?: OgcodeReportStatus; limit?: number } = {},
): Promise<OgcodeAdminReport[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  await ensureReportsSchema();
  const limit = Math.min(Math.max(1, options.limit ?? 200), 500);
  const params: unknown[] = [];
  let where = "";
  if (options.status) {
    params.push(options.status);
    where = `WHERE r.status = $${params.length}`;
  }
  params.push(limit);
  const res = await pool.query(
    `SELECT r.id, r.question_id, r.user_id, r.reason, r.description, r.status,
            r.created_at, r.updated_at,
            q.text AS question_stem, q.subject AS question_subject, q.difficulty AS question_difficulty
       FROM ogcode_question_reports r
       LEFT JOIN ogcode_questions q ON q.id = r.question_id
       ${where}
      ORDER BY (r.status = 'open') DESC, r.updated_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    questionId: String(row.question_id),
    userId: String(row.user_id),
    reason: row.reason as OgcodeReportReason,
    description: row.description ? String(row.description) : null,
    status: (row.status as OgcodeReportStatus) ?? "open",
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    questionStem: row.question_stem ? String(row.question_stem) : null,
    questionSubject: row.question_subject ? String(row.question_subject) : null,
    questionDifficulty: row.question_difficulty ? String(row.question_difficulty) : null,
  }));
}

/** Admin: counts by status for the header badges. */
export async function getOgcodeReportStatusCounts(): Promise<Record<OgcodeReportStatus, number>> {
  const base: Record<OgcodeReportStatus, number> = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 };
  const pool = getOgcodePostgresPool();
  if (!pool) return base;
  await ensureReportsSchema();
  const res = await pool.query<{ status: string; count: number | string }>(
    `SELECT status, COUNT(*) AS count FROM ogcode_question_reports GROUP BY status`,
  );
  for (const row of res.rows) {
    if (isOgcodeReportStatus(row.status)) base[row.status] = Number(row.count ?? 0);
  }
  return base;
}

/** Admin: move a report through triage. */
export async function updateOgcodeReportStatus(id: string, status: OgcodeReportStatus): Promise<{ ok: boolean }> {
  const pool = getOgcodePostgresPool();
  if (!pool) return { ok: false };
  await ensureReportsSchema();
  const res = await pool.query(
    `UPDATE ogcode_question_reports SET status = $2, updated_at = NOW() WHERE id = $1`,
    [id, status],
  );
  return { ok: (res.rowCount ?? 0) > 0 };
}
