/**
 * Workspace-wide teacher analytics — the cross-batch aggregates behind the
 * Overview section (plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md).
 *
 * POOL: OGCODE only. `analytics.test_results` + `analytics.test_topic_analytics`
 * live in the OGCODE database; `origin_users` / `app.*` live in the USER database
 * and in production those are SEPARATE Neon databases — so nothing here joins to
 * a roster table. Student names and batch names are merged by the service layer
 * (workspace-analytics-service.ts) from the USER pool. Same discipline as
 * batch-cohort-store.ts / test-cohort-store.ts.
 *
 * COST: three GROUP BY queries for the ENTIRE workspace — never one query per
 * batch. Each is driven by idx_test_results_cohort (workspace_id, batch_id, …).
 */

import type { Pool } from "pg";

import { getOgcodePostgresPool } from "@/server/postgres";
import { ensureAnalyticsTables } from "@/server/analytics-store";

function analyticsPool(): Pool {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured");
  return p;
}

/** Score stats for one batch, computed over per-student mean percentages. */
export type BatchScoreStats = {
  batchId: string;
  /** Mean of each ranked student's own mean percentage. Null = no submissions. */
  averagePercentage: number | null;
  topPercentage: number | null;
  lowestPercentage: number | null;
  medianPercentage: number | null;
  /** Students with at least one analysed, non-malpractice submission. */
  rankedStudents: number;
  /** Total submissions counted. */
  attempts: number;
  /** Distinct tests that actually received a submission in this batch. */
  testsConducted: number;
  /** Per-student means, ascending — feeds the batch score histogram. */
  studentMeans: number[];
};

/**
 * Per-batch score statistics for every batch in the workspace, in ONE query.
 *
 * Averages are taken over per-student means (not raw attempts) so a student who
 * sat ten tests does not outweigh one who sat two — the same definition the
 * batch leaderboard already uses.
 */
export async function getWorkspaceBatchScoreStats(
  workspaceId: string,
): Promise<Map<string, BatchScoreStats>> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `WITH per_student AS (
       SELECT batch_id,
              user_id,
              AVG(percentage::float8) AS mean_pct,
              COUNT(*)::int           AS attempts
         FROM analytics.test_results
        WHERE workspace_id = $1
          AND batch_id IS NOT NULL
          AND is_malpractice = FALSE
        GROUP BY batch_id, user_id
     ),
     per_batch_tests AS (
       -- Distinct tests the BATCH received submissions for. Counted here rather
       -- than inside per_student, where a DISTINCT would be per-student and
       -- aggregating it again would answer the wrong question.
       SELECT batch_id, COUNT(DISTINCT test_id)::int AS tests_conducted
         FROM analytics.test_results
        WHERE workspace_id = $1
          AND batch_id IS NOT NULL
          AND is_malpractice = FALSE
        GROUP BY batch_id
     )
     SELECT s.batch_id,
            AVG(s.mean_pct)::float8 AS batch_avg,
            MAX(s.mean_pct)::float8 AS batch_top,
            MIN(s.mean_pct)::float8 AS batch_low,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.mean_pct)::float8 AS batch_median,
            COUNT(*)::int           AS ranked_students,
            SUM(s.attempts)::int    AS attempts,
            COALESCE(MAX(t.tests_conducted), 0)::int AS tests_conducted,
            ARRAY_AGG(s.mean_pct ORDER BY s.mean_pct) AS student_means
       FROM per_student s
       LEFT JOIN per_batch_tests t ON t.batch_id = s.batch_id
      GROUP BY s.batch_id`,
    [workspaceId],
  );

  const stats = new Map<string, BatchScoreStats>();
  for (const row of result.rows) {
    const batchId = row.batch_id as string;
    stats.set(batchId, {
      batchId,
      averagePercentage: numberOrNull(row.batch_avg),
      topPercentage: numberOrNull(row.batch_top),
      lowestPercentage: numberOrNull(row.batch_low),
      medianPercentage: numberOrNull(row.batch_median),
      rankedStudents: Number(row.ranked_students) || 0,
      attempts: Number(row.attempts) || 0,
      testsConducted: Number(row.tests_conducted) || 0,
      studentMeans: ((row.student_means as unknown[]) ?? [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v)),
    });
  }
  return stats;
}

/** One (batch, subject, topic) accuracy cell across the workspace. */
export type WorkspaceTopicCell = {
  batchId: string;
  /** Lower-cased — subjects are stored inconsistently cased upstream. */
  subject: string;
  topic: string;
  /** 0–100 cohort mean accuracy. */
  accuracy: number;
  attempts: number;
  /** Distinct students who attempted this topic in this batch. */
  students: number;
};

/**
 * Per-(batch, subject, topic) accuracy for the whole workspace, in ONE query.
 *
 * Feeds BOTH the subject × batch heatmap (rolled up to subject in app code) and
 * the workspace weak-topic count — one round trip instead of two aggregates over
 * the same rows.
 */
export async function getWorkspaceTopicCells(
  workspaceId: string,
): Promise<WorkspaceTopicCell[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT tr.batch_id,
            LOWER(tta.subject) AS subject,
            tta.topic,
            AVG(tta.accuracy)::float8 AS accuracy,
            SUM(tta.attempts)::int    AS attempts,
            COUNT(DISTINCT tr.user_id)::int AS students
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1
        AND tr.batch_id IS NOT NULL
        AND tr.is_malpractice = FALSE
      GROUP BY tr.batch_id, LOWER(tta.subject), tta.topic`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    batchId: row.batch_id as string,
    subject: (row.subject as string) ?? "",
    topic: row.topic as string,
    accuracy: Number(row.accuracy) || 0,
    attempts: Number(row.attempts) || 0,
    students: Number(row.students) || 0,
  }));
}

/** A student's workspace-wide performance, before roster details are merged. */
export type WorkspaceStudentScore = {
  studentId: string;
  meanPercentage: number;
  bestPercentage: number;
  attempts: number;
  /** Most recent non-malpractice submission — the "last active" signal. */
  lastAttemptAt: string | null;
};

/**
 * Every student's workspace-wide mean, in ONE query. Backs top performers,
 * the at-risk table, and the global score distribution.
 *
 * Students with no analysed submission simply have no row here — the service
 * layer renders them as "no data" rather than inventing a 0%.
 */
export async function getWorkspaceStudentScores(
  workspaceId: string,
  options: { limit?: number } = {},
): Promise<WorkspaceStudentScore[]> {
  await ensureAnalyticsTables();
  // Guardrail for very large workspaces (ledger #12). Ordered by attempts so a
  // truncated result keeps the most-active students rather than an arbitrary set.
  const limit = Math.min(Math.max(options.limit ?? 5000, 1), 20000);
  const result = await analyticsPool().query(
    `SELECT user_id,
            AVG(percentage::float8) AS mean_pct,
            MAX(percentage::float8) AS best_pct,
            COUNT(*)::int           AS attempts,
            MAX(created_at)         AS last_attempt_at
       FROM analytics.test_results
      WHERE workspace_id = $1 AND is_malpractice = FALSE
      GROUP BY user_id
      ORDER BY attempts DESC
      LIMIT ${limit}`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    studentId: row.user_id as string,
    meanPercentage: Number(row.mean_pct) || 0,
    bestPercentage: Number(row.best_pct) || 0,
    attempts: Number(row.attempts) || 0,
    lastAttemptAt: row.last_attempt_at
      ? new Date(row.last_attempt_at as string).toISOString()
      : null,
  }));
}

/**
 * Distinct tests that received at least one non-malpractice submission in the
 * workspace — "tests conducted", as opposed to tests merely created.
 */
export async function countWorkspaceTestsConducted(workspaceId: string): Promise<number> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT COUNT(DISTINCT test_id)::int AS n
       FROM analytics.test_results
      WHERE workspace_id = $1 AND is_malpractice = FALSE`,
    [workspaceId],
  );
  return Number(result.rows[0]?.n) || 0;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
