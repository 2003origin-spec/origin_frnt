/**
 * Per-test teacher cohort analytics — reads the LIVE source of truth,
 * `analytics.test_results` (+ `analytics.test_topic_analytics`), which `submitTest`
 * (src/legacy/assessments.ts) cohort-tags with workspace_id/batch_id/assignment_id
 * for every assigned-test submission, and which the analytics-service populates with
 * per-topic signals via the analysis job.
 *
 * IMPORTANT — pool topology: the `analytics.*` tables live in the **OGCODE database**
 * (the legacy analytics store writes them via getOgcodePostgresPool). In production
 * OGCODE and USER are SEPARATE Neon databases (`origin_ogcode` vs `origin_users`), so
 * analytics rows must be read from the OGCODE pool, and student display names (in
 * `origin_users`, USER pool) are fetched separately and merged in app code — never a
 * cross-database JOIN. In dev both pools point at one DB, so the same code path works.
 *
 * NOTE: `assessment.test_attempts` records sittings (one row per retake, no
 * names or totals) — these readers intentionally do NOT use it for results.
 */

import type { Pool } from "pg";

import { getOgcodePostgresPool } from "@/server/postgres";
import { getUserPostgresPool } from "@/server/user-postgres";
import { ensureAnalyticsTables } from "@/server/analytics-store";

/** OGCODE pool — owns the analytics.* tables. */
function analyticsPool(): Pool {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured");
  return p;
}

/** Severity from a 0–100 accuracy (mirrors cohort-analytics.severityFromAccuracy). */
function severityFromAccuracy(accuracyPct: number): "high" | "medium" | "low" {
  if (accuracyPct < 35) return "high";
  if (accuracyPct < 60) return "medium";
  return "low";
}

/**
 * Resolve student display names from origin_users (USER pool) for a set of ids.
 * Best-effort: on any failure (or no USER pool) callers fall back to "Student".
 */
export async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return names;
  const userPool = getUserPostgresPool();
  if (!userPool) return names;
  try {
    const res = await userPool.query(
      `SELECT id, name FROM origin_users WHERE id = ANY($1::text[])`,
      [ids],
    );
    for (const row of res.rows) {
      if (row.name) names.set(row.id as string, row.name as string);
    }
  } catch {
    // Names are non-essential; the cohort still renders with the fallback label.
  }
  return names;
}

/** One student's submission of a teacher test (the "who attempted this test" row). */
export type TestCohortAttempt = {
  rank: number;
  resultId: string;
  studentId: string;
  displayName: string;
  batchId: string | null;
  percentage: number | null;
  score: number | null;
  totalMarks: number | null;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  analysisStatus: string;
  submittedAt: string;
};

/** One topic's cumulative weakness across all submissions of a teacher test. */
export type TestTopicWeakness = {
  topic: string;
  subject: string;
  chapter: string | null;
  accuracy: number; // 0–100, cohort mean
  attempts: number;
  students: number;
  severity: "high" | "medium" | "low";
};

/**
 * Students who attempted a given teacher test (one row per persisted result),
 * ranked by percentage desc then time asc. `test_id` on analytics.test_results is
 * the assessment.tests id for assigned tests, so test_id + workspace_id captures
 * every batch the test was assigned to; pass batchId to narrow to one batch.
 */
export async function getTestAttemptCohort(
  workspaceId: string,
  testId: string,
  opts?: { batchId?: string },
): Promise<TestCohortAttempt[]> {
  await ensureAnalyticsTables();
  const params: unknown[] = [testId, workspaceId];
  let extra = "";
  if (opts?.batchId) {
    params.push(opts.batchId);
    extra = ` AND batch_id = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT id AS result_id, user_id, batch_id, percentage, score, total_marks,
            correct_answers, wrong_answers, unattempted, time_taken_seconds,
            analysis_status, created_at
       FROM analytics.test_results
      WHERE test_id = $1 AND workspace_id = $2 AND is_malpractice = FALSE${extra}
      ORDER BY percentage DESC NULLS LAST, time_taken_seconds ASC`,
    params,
  );
  const names = await fetchDisplayNames(result.rows.map((r) => r.user_id as string));
  return result.rows.map((row, i) => ({
    rank: i + 1,
    resultId: row.result_id as string,
    studentId: row.user_id as string,
    displayName: names.get(row.user_id as string) ?? "Student",
    batchId: (row.batch_id as string | null) ?? null,
    percentage: row.percentage == null ? null : Number(row.percentage),
    score: row.score == null ? null : Number(row.score),
    totalMarks: row.total_marks == null ? null : Number(row.total_marks),
    correctAnswers: Number(row.correct_answers) || 0,
    wrongAnswers: Number(row.wrong_answers) || 0,
    unattempted: Number(row.unattempted) || 0,
    timeTakenSeconds: Number(row.time_taken_seconds) || 0,
    analysisStatus: String(row.analysis_status ?? "complete"),
    submittedAt: new Date(row.created_at as string).toISOString(),
  }));
}

/** One student's best submission of a teacher test, across every session. */
export type TestLeaderboardEntry = {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
  totalScore: number;
  scorePercentage: number;
  timeTakenSeconds: number;
  /** When the best submission was made. */
  attemptedAt: string;
  /** How many (non-malpractice) submissions the student made. */
  attemptCount: number;
};

/**
 * The test-level leaderboard ("all sessions of this test" in the room view):
 * ONE row per student — their best submission (highest percentage, then the
 * fastest) — read from analytics.test_results, which every assigned-test and
 * room submission writes, with display names merged from origin_users.
 * Not assessment.test_attempts: those rows carry no name or total, and there is
 * one per retake, which listed blank names and the same student repeatedly.
 */
export async function getTestLeaderboardFromResults(
  workspaceId: string,
  testId: string,
  limit = 20,
): Promise<TestLeaderboardEntry[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT * FROM (
       SELECT DISTINCT ON (user_id)
              user_id, score, total_marks, percentage, time_taken_seconds, created_at,
              COUNT(*) OVER (PARTITION BY user_id)::int AS attempt_count
         FROM analytics.test_results
        WHERE test_id = $1 AND workspace_id = $2 AND is_malpractice = FALSE
        ORDER BY user_id, percentage DESC NULLS LAST, time_taken_seconds ASC NULLS LAST, created_at ASC
     ) best
     ORDER BY percentage DESC NULLS LAST, time_taken_seconds ASC NULLS LAST, created_at ASC
     LIMIT $3`,
    [testId, workspaceId, Math.max(1, Math.trunc(limit) || 20)],
  );
  const names = await fetchDisplayNames(result.rows.map((r) => r.user_id as string));
  return result.rows.map((row, i) => ({
    rank: i + 1,
    studentId: row.user_id as string,
    studentName: names.get(row.user_id as string) ?? "Student",
    score: Number(row.score) || 0,
    totalScore: Number(row.total_marks) || 0,
    scorePercentage: Number(row.percentage) || 0,
    timeTakenSeconds: Number(row.time_taken_seconds) || 0,
    attemptedAt: new Date(row.created_at as string).toISOString(),
    attemptCount: Number(row.attempt_count) || 1,
  }));
}

/**
 * How many persisted student results exist for a teacher test (every
 * submission, malpractice included — they are still a student's record). The
 * delete guard counts these: assessment.test_attempts only began recording
 * sittings recently, so older submissions exist ONLY here.
 */
export async function countTestResults(testId: string): Promise<number> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT COUNT(*)::int AS n FROM analytics.test_results WHERE test_id = $1`,
    [testId],
  );
  return Number(result.rows[0]?.n) || 0;
}

/**
 * Cumulative per-topic weakness for a teacher test — the mean topic accuracy across
 * every student's submission, weakest first. Backs the per-test mastery radar.
 * Produced by the analytics-service (analytics.test_topic_analytics); empty until
 * submissions have been analysed. Both tables live in the OGCODE DB, so this JOIN is
 * single-database.
 */
export async function getTestTopicWeakness(
  workspaceId: string,
  testId: string,
): Promise<TestTopicWeakness[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT tta.subject, tta.topic, MAX(tta.chapter) AS chapter,
            AVG(tta.accuracy)::float8 AS avg_accuracy,
            SUM(tta.attempts)::int AS attempts,
            COUNT(DISTINCT tr.user_id)::int AS students
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.test_id = $1 AND tr.workspace_id = $2 AND tr.is_malpractice = FALSE
      GROUP BY tta.subject, tta.topic
      ORDER BY avg_accuracy ASC`,
    [testId, workspaceId],
  );
  return result.rows.map((row) => {
    const accuracy = Math.round((Number(row.avg_accuracy) || 0) * 100) / 100;
    return {
      topic: row.topic as string,
      subject: row.subject as string,
      chapter: (row.chapter as string | null) ?? null,
      accuracy,
      attempts: Number(row.attempts) || 0,
      students: Number(row.students) || 0,
      severity: severityFromAccuracy(accuracy),
    };
  });
}

/**
 * The owning student of a persisted result, scoped to a workspace — the authz gate
 * for a teacher loading a student's individual analytics. Returns null when the
 * result does not belong to this workspace (caller maps to 404).
 */
export async function getCohortResultOwner(
  workspaceId: string,
  resultId: string,
): Promise<string | null> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT user_id FROM analytics.test_results
      WHERE id = $1 AND workspace_id = $2`,
    [resultId, workspaceId],
  );
  return result.rows[0] ? (result.rows[0].user_id as string) : null;
}
