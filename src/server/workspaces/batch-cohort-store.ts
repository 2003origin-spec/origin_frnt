/**
 * Batch-level teacher analytics, computed at READ time from the live source of
 * truth (analytics.test_results + analytics.test_topic_analytics in the OGCODE DB),
 * with student names merged from origin_users (USER DB).
 *
 * This replaces the Phase-8 pre-aggregated tables (batch_topic_snapshots /
 * student_topic_profiles / leaderboard_snapshots) populated by
 * populateCohortAnalytics, which cannot run in the split-DB production topology
 * (analytics tables live in origin_ogcode; app.* and origin_users in origin_users
 * — no cross-database joins). Read-time aggregation needs no background population and
 * works in both split (prod) and co-located (dev) topologies.
 *
 * Accuracy is returned as a 0–1 ratio to match the shapes the existing
 * AnalyticsCenterHighFidelity component already consumes.
 */

import type { Pool } from "pg";

import { getOgcodePostgresPool } from "@/server/postgres";
import { ensureAnalyticsTables } from "@/server/analytics-store";

import { fetchDisplayNames } from "./test-cohort-store";
import { getBatchTopicCoverage, coverageKey } from "./batch-topic-coverage-store";

function analyticsPool(): Pool {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured");
  return p;
}

function severityFromAccuracy(accuracyPct: number): "high" | "medium" | "low" {
  if (accuracyPct < 35) return "high";
  if (accuracyPct < 60) return "medium";
  return "low";
}

/** Matches the TopicSnapshot shape AnalyticsCenterHighFidelity consumes. */
export type BatchTopicSnapshotLite = {
  id: string;
  topic: string;
  subject: string;
  chapter: string | null;
  accuracy: number; // 0–1
  attempts: number;
  severity: "high" | "medium" | "low";
  snapshotAt: string;
  /** Teacher marked this topic as covered in the next class. */
  covered: boolean;
  /** Distinct students who attempted this topic in the batch. */
  students: number;
  /** Of those, how many are below 50% — the intervention-panel headline. */
  studentsAffected: number;
};

export type BatchLeaderboardEntryLite = {
  rank: number;
  studentId: string;
  displayName: string;
  meanPercentage: number;
  attempts: number;
  platformRank: number;
};

export type StudentTopicProfileLite = {
  topic: string;
  subject: string;
  chapter: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0–1
  /** Bayesian Knowledge Tracing posterior from analytics-service (0–1). */
  masteryScore: number;
  /** analytics-service flagged an anomalous answer pattern on this topic. */
  anomaly?: boolean;
  lastAttemptAt: string | null;
};

/**
 * Per-topic accuracy across all of a batch's analysed submissions, weakest first.
 * Backs both the mastery radar (all topics) and the weak-concept list (weakOnly).
 */
export async function getBatchTopicAccuracyLive(
  workspaceId: string,
  batchId: string,
  opts?: { subject?: string; weakOnly?: boolean },
): Promise<BatchTopicSnapshotLite[]> {
  await ensureAnalyticsTables();
  const params: unknown[] = [workspaceId, batchId];
  let subjectFilter = "";
  if (opts?.subject) {
    params.push(opts.subject);
    subjectFilter = ` AND tta.subject = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT tta.subject, tta.topic, MAX(tta.chapter) AS chapter,
            AVG(tta.accuracy)::float8 AS avg_accuracy,
            SUM(tta.attempts)::int AS attempts,
            COUNT(DISTINCT tr.user_id)::int AS students,
            COUNT(DISTINCT tr.user_id) FILTER (WHERE tta.accuracy < 50)::int AS students_affected
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.batch_id = $2 AND tr.is_malpractice = FALSE${subjectFilter}
      GROUP BY tta.subject, tta.topic
      ORDER BY avg_accuracy ASC`,
    params,
  );
  const coverage = await getBatchTopicCoverage(workspaceId, batchId);
  const now = new Date().toISOString();
  const rows = result.rows.map((row) => {
    const accuracyPct = Number(row.avg_accuracy) || 0;
    const subject = row.subject as string;
    const topic = row.topic as string;
    return {
      id: `${subject}-${topic}`,
      topic,
      subject,
      chapter: (row.chapter as string | null) ?? null,
      accuracy: Math.round(accuracyPct) / 100,
      attempts: Number(row.attempts) || 0,
      severity: severityFromAccuracy(accuracyPct),
      snapshotAt: now,
      covered: coverage.get(coverageKey(subject, topic)) ?? false,
      students: Number(row.students) || 0,
      studentsAffected: Number(row.students_affected) || 0,
    };
  });
  return opts?.weakOnly ? rows.filter((r) => r.severity !== "low") : rows;
}

/**
 * Batch leaderboard — every student who has an analysed submission tagged to the
 * batch, ranked by mean test percentage (secondary platform rank by cumulative
 * score). No min-attempts floor: the teacher wants to see everyone who attempted.
 */
export async function getBatchLeaderboardLive(
  workspaceId: string,
  batchId: string,
): Promise<BatchLeaderboardEntryLite[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT tr.user_id,
            AVG(tr.percentage)::float8 AS mean_pct,
            SUM(tr.score)::float8      AS total_score,
            COUNT(*)::int             AS attempts
       FROM analytics.test_results tr
      WHERE tr.workspace_id = $1 AND tr.batch_id = $2 AND tr.is_malpractice = FALSE
      GROUP BY tr.user_id`,
    [workspaceId, batchId],
  );
  const names = await fetchDisplayNames(result.rows.map((r) => r.user_id as string));
  const rows = result.rows.map((row) => ({
    studentId: row.user_id as string,
    displayName: names.get(row.user_id as string) ?? "Student",
    meanPercentage: Math.round((Number(row.mean_pct) || 0) * 100) / 100,
    totalScore: Math.round((Number(row.total_score) || 0) * 100) / 100,
    attempts: Number(row.attempts) || 0,
  }));

  const platformOrder = [...rows].sort((a, b) => b.totalScore - a.totalScore);
  const platformRankById = new Map<string, number>();
  platformOrder.forEach((r, i) => platformRankById.set(r.studentId, i + 1));

  return rows
    .sort((a, b) => b.meanPercentage - a.meanPercentage || b.attempts - a.attempts)
    .map((r, i) => ({
      rank: i + 1,
      studentId: r.studentId,
      displayName: r.displayName,
      meanPercentage: r.meanPercentage,
      attempts: r.attempts,
      platformRank: platformRankById.get(r.studentId) ?? i + 1,
    }));
}

/** Raw practice totals for one student, before ranking. */
export type BatchPracticeRowLite = {
  studentId: string;
  displayName: string;
  /** Marks scored across the teacher's shared DPPs in this batch. */
  dppScore: number;
  /** Marks available across those DPPs (for accuracy). */
  dppTotalMarks: number;
  dppsCompleted: number;
  /** All-time OG Code practice score (platform-wide — the student's own work). */
  ogcodeScore: number;
  ogcodeQuestions: number;
  lastPractisedAt: string | null;
};

/**
 * Practice totals for a batch: the teacher's shared DPPs **and** the students'
 * own OG Code work, per student.
 *
 * Both live in the OGCODE pool — `analytics.dpp_attempts ⋈ analytics.dpp_plans`
 * for the DPP half (cohort context is on the plan, so no cross-pool join) and
 * `ogcode_question_progress` for the OG Code half. The batch roster is the one
 * thing that comes from the USER pool, so the caller passes `studentIds` in
 * rather than this function reaching across.
 *
 * Passing the roster in also means a student who has ground the OG Code bank
 * but not yet touched a shared DPP still appears (with a 0 DPP score), and an
 * ex-member who has left the batch does not.
 */
export async function getBatchPracticeLeaderboardLive(
  workspaceId: string,
  batchId: string,
  studentIds: readonly string[],
): Promise<BatchPracticeRowLite[]> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return [];
  await ensureAnalyticsTables();
  const pool = analyticsPool();

  const [dppResult, ogcodeResult] = await Promise.all([
    // DISTINCT ON keeps only each student's LATEST attempt per DPP, so
    // re-submitting the same set cannot farm the leaderboard. `score IS NOT
    // NULL` excludes attempts made before marks-based scoring existed — those
    // are unknown, not zero, and ranking them as zero would mis-rank students.
    pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (a.dpp_id)
                a.dpp_id, a.user_id, a.score, a.total_marks, a.created_at
           FROM analytics.dpp_attempts a
           JOIN analytics.dpp_plans p ON p.id = a.dpp_id
          WHERE p.origin = 'teacher'
            AND p.workspace_id = $1
            AND p.batch_id = $2
            AND a.user_id = ANY($3::text[])
            AND a.score IS NOT NULL
          ORDER BY a.dpp_id, a.created_at DESC
       )
       SELECT user_id,
              SUM(score)::float8       AS dpp_score,
              SUM(total_marks)::float8 AS dpp_total_marks,
              COUNT(*)::int            AS dpps_completed,
              MAX(created_at)          AS last_practised_at
         FROM latest
        GROUP BY user_id`,
      [workspaceId, batchId, ids],
    ),
    pool.query(
      `SELECT user_id,
              SUM(COALESCE(best_score, 0))::float8 AS ogcode_score,
              COUNT(*)::int                        AS ogcode_questions
         FROM ogcode_question_progress
        WHERE user_id = ANY($1::text[]) AND attempted = TRUE
        GROUP BY user_id`,
      [ids],
    ),
  ]);

  const names = await fetchDisplayNames(ids);
  const ogcodeById = new Map(
    ogcodeResult.rows.map((row) => [
      String(row.user_id),
      {
        score: Number(row.ogcode_score) || 0,
        questions: Number(row.ogcode_questions) || 0,
      },
    ]),
  );
  const dppById = new Map(dppResult.rows.map((row) => [String(row.user_id), row]));

  return ids.map((studentId) => {
    const dpp = dppById.get(studentId);
    const ogcode = ogcodeById.get(studentId);
    const lastRaw = dpp?.last_practised_at;
    return {
      studentId,
      displayName: names.get(studentId) ?? "Student",
      dppScore: Math.round((Number(dpp?.dpp_score) || 0) * 100) / 100,
      dppTotalMarks: Math.round((Number(dpp?.dpp_total_marks) || 0) * 100) / 100,
      dppsCompleted: Number(dpp?.dpps_completed) || 0,
      ogcodeScore: Math.round((ogcode?.score ?? 0) * 100) / 100,
      ogcodeQuestions: ogcode?.questions ?? 0,
      lastPractisedAt: lastRaw instanceof Date ? lastRaw.toISOString() : lastRaw ? String(lastRaw) : null,
    };
  });
}

/** One shared DPP a student has completed, for the 360° profile. */
export type StudentDppHistoryEntry = {
  dppId: string;
  title: string;
  subject: string;
  score: number;
  totalMarks: number;
  percentage: number | null;
  timeTakenSeconds: number;
  completedAt: string;
};

/** Practice totals + per-DPP history for one student inside one workspace. */
export type StudentPracticeProfile = {
  dppsCompleted: number;
  dppScore: number;
  dppTotalMarks: number;
  dppAccuracy: number | null;
  ogcodeScore: number;
  ogcodeQuestions: number;
  history: StudentDppHistoryEntry[];
};

/**
 * A student's practice record: the teacher's shared DPPs (scoped to THIS
 * workspace, so one institute never sees another's assigned work) plus their
 * all-time OG Code score (platform-wide — it is the student's own practice and
 * is not workspace-owned).
 *
 * Latest attempt per DPP only, matching the leaderboard, so the profile and the
 * board can never disagree about the same student.
 */
export async function getStudentPracticeProfileLive(
  workspaceId: string,
  studentId: string,
): Promise<StudentPracticeProfile> {
  await ensureAnalyticsTables();
  const pool = analyticsPool();

  const [dppResult, ogcodeResult] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (a.dpp_id)
              a.dpp_id, a.title, p.subject, a.score, a.total_marks, a.percentage,
              a.time_taken_seconds, a.created_at
         FROM analytics.dpp_attempts a
         JOIN analytics.dpp_plans p ON p.id = a.dpp_id
        WHERE p.origin = 'teacher'
          AND p.workspace_id = $1
          AND a.user_id = $2
          AND a.score IS NOT NULL
        ORDER BY a.dpp_id, a.created_at DESC`,
      [workspaceId, studentId],
    ),
    pool.query(
      `SELECT SUM(COALESCE(best_score, 0))::float8 AS ogcode_score,
              COUNT(*)::int                        AS ogcode_questions
         FROM ogcode_question_progress
        WHERE user_id = $1 AND attempted = TRUE`,
      [studentId],
    ),
  ]);

  const history: StudentDppHistoryEntry[] = dppResult.rows
    .map((row) => {
      const completedAt = row.created_at;
      return {
        dppId: String(row.dpp_id),
        title: String(row.title),
        subject: String(row.subject ?? ""),
        score: Math.round((Number(row.score) || 0) * 100) / 100,
        totalMarks: Math.round((Number(row.total_marks) || 0) * 100) / 100,
        percentage: row.percentage === null ? null : Math.round(Number(row.percentage) * 10) / 10,
        timeTakenSeconds: Number(row.time_taken_seconds) || 0,
        completedAt:
          completedAt instanceof Date ? completedAt.toISOString() : String(completedAt),
      };
    })
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const dppScore = history.reduce((sum, entry) => sum + entry.score, 0);
  const dppTotalMarks = history.reduce((sum, entry) => sum + entry.totalMarks, 0);
  const ogcodeRow = ogcodeResult.rows[0];

  return {
    dppsCompleted: history.length,
    dppScore: Math.round(dppScore * 100) / 100,
    dppTotalMarks: Math.round(dppTotalMarks * 100) / 100,
    dppAccuracy: dppTotalMarks > 0 ? Math.round((dppScore / dppTotalMarks) * 1000) / 10 : null,
    ogcodeScore: Math.round((Number(ogcodeRow?.ogcode_score) || 0) * 100) / 100,
    ogcodeQuestions: Number(ogcodeRow?.ogcode_questions) || 0,
    history,
  };
}

/**
 * A single student's per-topic profile across the workspace, weakest first — the
 * teacher's individual drill-down. Aggregated live from the student's analysed
 * submissions (OGCODE DB).
 */
export async function getStudentTopicProfileLive(
  workspaceId: string,
  studentId: string,
  subject?: string,
): Promise<StudentTopicProfileLite[]> {
  await ensureAnalyticsTables();
  const params: unknown[] = [workspaceId, studentId];
  let subjectFilter = "";
  if (subject) {
    params.push(subject);
    subjectFilter = ` AND tta.subject = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT tta.subject, tta.topic, MAX(tta.chapter) AS chapter,
            SUM(tta.attempts)::int AS total_attempts,
            SUM(ROUND(tta.accuracy / 100.0 * tta.attempts))::int AS correct_attempts,
            AVG(tta.accuracy)::float8 AS avg_accuracy,
            AVG(tta.bkt_mastery)::float8 AS avg_mastery,
            BOOL_OR(tta.anomaly) AS anomaly,
            MAX(tr.created_at) AS last_attempt_at
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.user_id = $2 AND tr.is_malpractice = FALSE${subjectFilter}
      GROUP BY tta.subject, tta.topic
      ORDER BY avg_accuracy ASC, total_attempts DESC`,
    params,
  );
  return result.rows.map((row) => {
    const totalAttempts = Number(row.total_attempts) || 0;
    const correctAttempts = Number(row.correct_attempts) || 0;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    // Mastery is the analytics-service's Bayesian Knowledge Tracing posterior
    // (`bkt_mastery`, already 0–1) — NOT a copy of accuracy. It answers "has this
    // student actually learnt the topic", which diverges from raw accuracy when
    // attempts are few or streaky. Falls back to accuracy only for legacy rows
    // written before the column was populated.
    const mastery = Number(row.avg_mastery);
    return {
      topic: row.topic as string,
      subject: row.subject as string,
      chapter: (row.chapter as string | null) ?? null,
      totalAttempts,
      correctAttempts,
      accuracy,
      masteryScore: Number.isFinite(mastery) && mastery > 0 ? mastery : accuracy,
      /** analytics-service flagged this topic's pattern as anomalous. */
      anomaly: row.anomaly === true,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at as string).toISOString() : null,
    };
  });
}

// ─── Teacher Analytics Deep-Dive additions ────────────────────────────────────
// Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md

/** One test's cohort average for a batch — a point on the performance timeline. */
export type BatchTimelinePoint = {
  testId: string;
  title: string;
  subject: string | null;
  /** Cohort mean percentage for this test in this batch. */
  averagePercentage: number;
  topPercentage: number;
  /** Distinct students who submitted. */
  students: number;
  /** First submission timestamp — the x-axis anchor. */
  conductedAt: string;
};

/**
 * Batch average per test over time, oldest first — the "is this batch improving?"
 * line chart. One row per test that actually received a submission, so a test
 * created but never taken does not put a hole in the trend.
 */
export async function getBatchTestTimelineLive(
  workspaceId: string,
  batchId: string,
  options: { limit?: number } = {},
): Promise<BatchTimelinePoint[]> {
  await ensureAnalyticsTables();
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const result = await analyticsPool().query(
    `SELECT test_id,
            MIN(title)      AS title,
            MIN(subject)    AS subject,
            AVG(percentage::float8) AS avg_pct,
            MAX(percentage::float8) AS top_pct,
            COUNT(DISTINCT user_id)::int AS students,
            MIN(created_at) AS conducted_at
       FROM analytics.test_results
      WHERE workspace_id = $1 AND batch_id = $2 AND is_malpractice = FALSE
      GROUP BY test_id
      ORDER BY conducted_at DESC
      LIMIT ${limit}`,
    [workspaceId, batchId],
  );
  // Query takes the newest N (so a long-running batch keeps recent history);
  // the chart wants them chronologically.
  return result.rows
    .map((row) => ({
      testId: row.test_id as string,
      title: (row.title as string | null) ?? "Test",
      subject: (row.subject as string | null) ?? null,
      averagePercentage: Math.round((Number(row.avg_pct) || 0) * 10) / 10,
      topPercentage: Math.round((Number(row.top_pct) || 0) * 10) / 10,
      students: Number(row.students) || 0,
      conductedAt: new Date(row.conducted_at as string).toISOString(),
    }))
    .reverse();
}

/** One submission in a student's workspace test history. */
export type StudentTestHistoryEntry = {
  resultId: string;
  testId: string;
  title: string;
  subject: string | null;
  batchId: string | null;
  percentage: number;
  score: number | null;
  totalMarks: number | null;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  submittedAt: string;
  /** AI summary from the analysis job — present on the newest entries only. */
  summary: string | null;
  recommendations: string[];
};

/**
 * A student's submissions inside this workspace, newest first — backs the test
 * history table, the score-trend chart, and the AI analysis card of the 360°
 * profile. Scoped by workspace_id so a teacher never sees a student's work for
 * a different institute.
 */
export async function getStudentTestHistoryLive(
  workspaceId: string,
  studentId: string,
  options: { limit?: number; batchId?: string } = {},
): Promise<StudentTestHistoryEntry[]> {
  await ensureAnalyticsTables();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const params: unknown[] = [workspaceId, studentId];
  let batchFilter = "";
  if (options.batchId) {
    params.push(options.batchId);
    batchFilter = ` AND batch_id = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT id, test_id, title, subject, batch_id, percentage, score, total_marks,
            correct_answers, wrong_answers, unattempted, time_taken_seconds,
            summary, recommendations, created_at
       FROM analytics.test_results
      WHERE workspace_id = $1 AND user_id = $2 AND is_malpractice = FALSE${batchFilter}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    params,
  );
  return result.rows.map((row) => ({
    resultId: row.id as string,
    testId: row.test_id as string,
    title: (row.title as string | null) ?? "Test",
    subject: (row.subject as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    percentage: Number(row.percentage) || 0,
    score: row.score == null ? null : Number(row.score),
    totalMarks: row.total_marks == null ? null : Number(row.total_marks),
    correctAnswers: Number(row.correct_answers) || 0,
    wrongAnswers: Number(row.wrong_answers) || 0,
    unattempted: Number(row.unattempted) || 0,
    timeTakenSeconds: Number(row.time_taken_seconds) || 0,
    submittedAt: new Date(row.created_at as string).toISOString(),
    summary: (row.summary as string | null) || null,
    recommendations: Array.isArray(row.recommendations)
      ? (row.recommendations as unknown[]).map((r) => String(r)).filter(Boolean)
      : [],
  }));
}

/** Per-student topic accuracy + mastery inside one batch. */
export type BatchStudentMastery = {
  /** Mean topic accuracy 0–100 — distinct from mean TEST percentage. */
  topicAccuracy: number;
  /** Mean BKT mastery 0–1. */
  mastery: number;
  /** Topics where analytics-service flagged an anomalous pattern. */
  anomalousTopics: number;
};

/**
 * Mean topic accuracy and BKT mastery per student for a batch, in ONE query.
 *
 * This is the ranking table's "Accuracy" column, which is deliberately NOT the
 * same number as "Mean %": mean percentage is how they scored on whole tests,
 * topic accuracy is how they perform per concept. A student can pass tests while
 * being weak across many topics, and that gap is the point of the column.
 */
export async function getBatchStudentMasteryLive(
  workspaceId: string,
  batchId: string,
): Promise<Map<string, BatchStudentMastery>> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT tr.user_id,
            AVG(tta.accuracy)::float8    AS topic_accuracy,
            AVG(tta.bkt_mastery)::float8 AS mastery,
            COUNT(*) FILTER (WHERE tta.anomaly)::int AS anomalous_topics
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.batch_id = $2 AND tr.is_malpractice = FALSE
      GROUP BY tr.user_id`,
    [workspaceId, batchId],
  );
  const map = new Map<string, BatchStudentMastery>();
  for (const row of result.rows) {
    map.set(row.user_id as string, {
      topicAccuracy: Math.round((Number(row.topic_accuracy) || 0) * 10) / 10,
      mastery: Number(row.mastery) || 0,
      anomalousTopics: Number(row.anomalous_topics) || 0,
    });
  }
  return map;
}

/** Per-subject accuracy for one student — the 360° subject radar. */
export type StudentSubjectAccuracy = {
  subject: string;
  accuracy: number; // 0–100
  attempts: number;
  topics: number;
};

/**
 * A student's accuracy rolled up per subject across the workspace. Derived from
 * the same per-topic rows as the mastery matrix so the radar and the table can
 * never disagree.
 */
export async function getStudentSubjectAccuracyLive(
  workspaceId: string,
  studentId: string,
): Promise<StudentSubjectAccuracy[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT LOWER(tta.subject) AS subject,
            AVG(tta.accuracy)::float8 AS accuracy,
            SUM(tta.attempts)::int    AS attempts,
            COUNT(DISTINCT tta.topic)::int AS topics
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.user_id = $2 AND tr.is_malpractice = FALSE
      GROUP BY LOWER(tta.subject)
      ORDER BY accuracy DESC`,
    [workspaceId, studentId],
  );
  return result.rows.map((row) => ({
    subject: (row.subject as string) ?? "",
    accuracy: Math.round((Number(row.accuracy) || 0) * 10) / 10,
    attempts: Number(row.attempts) || 0,
    topics: Number(row.topics) || 0,
  }));
}
