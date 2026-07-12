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
