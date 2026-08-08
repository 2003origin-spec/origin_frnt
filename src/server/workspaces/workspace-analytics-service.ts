/**
 * Teacher Analytics Deep-Dive — composition layer.
 * Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md
 *
 * This is the ONLY module that touches both pools. Each underlying store stays
 * single-pool (OGCODE for `analytics.*`, USER for `app.*` + `origin_users`) and
 * this layer merges the two result sets in app code by `student_id` / `batch_id`
 * — the same discipline batch-cohort-store already follows, and the only option
 * in production where the two are separate Neon databases.
 *
 * It also owns the degradation contract (ledger #11): a workspace with no
 * submissions, or an environment with a pool unconfigured, yields an EMPTY but
 * well-formed payload with `available: false` — never a 500, and never a
 * fabricated zero. Callers render an explanatory empty state.
 */

import {
  average,
  median,
  scoreBuckets,
  istDateStrings,
  weekdayLabel,
  SEVERITY_ORDER,
  type ScoreBucket,
} from "@/lib/teacher-analytics";

import { isFeatureEnabled } from "@/lib/feature-flags";

import { listBatches, listBatchMembers } from "./batches";
import {
  rankPractitioners,
  summarisePractice,
  type PracticeLeaderboardEntry,
  type PracticeLeaderboardSummary,
  type PracticeRankBasis,
} from "./practice-leaderboard";
import {
  getBatchLeaderboardLive,
  getBatchPracticeLeaderboardLive,
  getStudentPracticeProfileLive,
  getBatchStudentMasteryLive,
  getBatchTestTimelineLive,
  getBatchTopicAccuracyLive,
  getStudentSubjectAccuracyLive,
  getStudentTestHistoryLive,
  getStudentTopicProfileLive,
  type BatchLeaderboardEntryLite,
  type BatchStudentMastery,
  type BatchTimelinePoint,
  type BatchTopicSnapshotLite,
  type StudentSubjectAccuracy,
  type StudentTestHistoryEntry,
  type StudentPracticeProfile,
  type StudentTopicProfileLite,
} from "./batch-cohort-store";
import {
  countWorkspaceTestsConducted,
  getWorkspaceBatchScoreStats,
  getWorkspaceStudentScores,
  getWorkspaceTopicCells,
  type BatchScoreStats,
} from "./workspace-analytics-store";
import {
  getDailyActivityForStudents,
  getPointsForStudents,
  getStreaksForStudents,
  type StudentStreak,
} from "./student-engagement-store";
import {
  getDirectoryStudent,
  getStudentSearchProvider,
  getWorkspaceBatchMemberships,
  getWorkspaceStudyTimeAverage,
  type DirectoryStudentRow,
  type StudentDirectoryQuery,
} from "./student-directory-store";
import { fetchDisplayNames } from "./test-cohort-store";

/** Mean below which a student is surfaced in the at-risk table (PRD §3.2). */
const AT_RISK_THRESHOLD = 40;
/** Accuracy below which a topic counts as "weak" for the workspace KPI. */
const WEAK_TOPIC_THRESHOLD = 35;

/**
 * Run a read that depends on an optional database pool. Any failure degrades to
 * `fallback` rather than failing the whole page — an unconfigured
 * OGCODE_DATABASE_URL in a preview must not take out the Overview.
 */
async function safe<T>(read: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.warn(`[teacher-analytics] ${label} unavailable:`, error);
    return fallback;
  }
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export type OverviewKpis = {
  totalStudents: number;
  activeBatches: number;
  averagePercentage: number | null;
  testsConducted: number;
  weakTopics: number;
  averageStudyMinutes: number | null;
};

export type BatchComparisonRow = {
  batchId: string;
  name: string;
  course: string | null;
  subject: string | null;
  studentCount: number;
  rankedStudents: number;
  averagePercentage: number | null;
  topPercentage: number | null;
  lowestPercentage: number | null;
  medianPercentage: number | null;
  testsConducted: number;
};

export type OverviewStudentRow = {
  studentId: string;
  name: string;
  batchNames: string[];
  meanPercentage: number;
  attempts: number;
  streak: number;
  lastAttemptAt: string | null;
};

export type SubjectHeatmapRow = {
  subject: string;
  cells: Array<{ batchId: string; accuracy: number | null; attempts: number }>;
};

export type WorkspaceOverviewAnalytics = {
  /** False when no analysed submission exists yet (or a pool is unconfigured). */
  available: boolean;
  kpis: OverviewKpis;
  batches: BatchComparisonRow[];
  topPerformers: OverviewStudentRow[];
  atRisk: OverviewStudentRow[];
  heatmap: { batches: Array<{ id: string; name: string }>; rows: SubjectHeatmapRow[] };
  scoreDistribution: ScoreBucket[];
  /** Students with at least one analysed submission. */
  rankedStudents: number;
};

/**
 * Everything the Overview analytics block needs, in one call. Six reads run in
 * parallel: three OGCODE aggregates and three USER roster reads.
 *
 * Called directly from the Overview Server Component — no API round trip (D2).
 */
export async function getWorkspaceOverviewAnalytics(
  workspaceId: string,
): Promise<WorkspaceOverviewAnalytics> {
  const [batches, batchStats, topicCells, studentScores, testsConducted, studyTime, memberships] =
    await Promise.all([
      safe(() => listBatches(workspaceId, { status: "all" }), [], "batches"),
      safe(
        () => getWorkspaceBatchScoreStats(workspaceId),
        new Map<string, BatchScoreStats>(),
        "batch score stats",
      ),
      safe(() => getWorkspaceTopicCells(workspaceId), [], "topic cells"),
      safe(() => getWorkspaceStudentScores(workspaceId), [], "student scores"),
      safe(() => countWorkspaceTestsConducted(workspaceId), 0, "tests conducted"),
      safe(
        () => getWorkspaceStudyTimeAverage(workspaceId),
        { averageMinutes: null, students: 0 },
        "study time",
      ),
      safe(() => getWorkspaceBatchMemberships(workspaceId), new Map<string, string[]>(), "memberships"),
    ]);

  const activeBatches = batches.filter((b) => b.status === "active");
  const batchNameById = new Map(batches.map((b) => [b.id, b.name]));

  // Only batches that exist in the roster are charted — a stale batch_id in an
  // analytics row (deleted batch) must not invent a nameless column.
  const comparison: BatchComparisonRow[] = activeBatches.map((batch) => {
    const stats = batchStats.get(batch.id);
    return {
      batchId: batch.id,
      name: batch.name,
      course: batch.course,
      subject: batch.subject,
      studentCount: batch.studentCount,
      rankedStudents: stats?.rankedStudents ?? 0,
      averagePercentage: roundOrNull(stats?.averagePercentage),
      topPercentage: roundOrNull(stats?.topPercentage),
      lowestPercentage: roundOrNull(stats?.lowestPercentage),
      medianPercentage: roundOrNull(stats?.medianPercentage),
      testsConducted: stats?.testsConducted ?? 0,
    };
  });
  // Charts read best sorted descending by the compared value (chart guidance).
  comparison.sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));

  // Student rows: OGCODE scores ⋈ USER names/streaks/batches, merged in app code.
  const scoredIds = studentScores.map((s) => s.studentId);
  const [names, streaks] = await Promise.all([
    safe(() => fetchDisplayNames(scoredIds), new Map<string, string>(), "display names"),
    safe(() => getStreaksForStudents(scoredIds), new Map<string, StudentStreak>(), "streaks"),
  ]);

  const studentRows: OverviewStudentRow[] = studentScores.map((score) => ({
    studentId: score.studentId,
    name: names.get(score.studentId) ?? "Student",
    batchNames: (memberships.get(score.studentId) ?? [])
      .map((id) => batchNameById.get(id))
      .filter((n): n is string => Boolean(n)),
    meanPercentage: Math.round(score.meanPercentage * 10) / 10,
    attempts: score.attempts,
    streak: streaks.get(score.studentId)?.currentStreak ?? 0,
    lastAttemptAt: score.lastAttemptAt,
  }));

  const topPerformers = [...studentRows]
    .sort((a, b) => b.meanPercentage - a.meanPercentage || b.attempts - a.attempts)
    .slice(0, 8);
  // Every at-risk student, not a top-N: a teacher needs the whole list to act on
  // it. The UI scrolls; the cap is only a runaway guard for a huge institute.
  const atRisk = studentRows
    .filter((s) => s.meanPercentage < AT_RISK_THRESHOLD)
    .sort((a, b) => a.meanPercentage - b.meanPercentage)
    .slice(0, 200);

  // Subject × batch heatmap: roll the per-topic cells up to subject level.
  const activeBatchIds = new Set(activeBatches.map((b) => b.id));
  const bySubjectBatch = new Map<string, { total: number; count: number; attempts: number }>();
  const subjects = new Set<string>();
  let weakTopics = 0;
  for (const cell of topicCells) {
    if (!activeBatchIds.has(cell.batchId)) continue;
    if (cell.accuracy < WEAK_TOPIC_THRESHOLD) weakTopics += 1;
    const subject = cell.subject || "unspecified";
    subjects.add(subject);
    const key = `${cell.batchId}|||${subject}`;
    const bucket = bySubjectBatch.get(key) ?? { total: 0, count: 0, attempts: 0 };
    bucket.total += cell.accuracy;
    bucket.count += 1;
    bucket.attempts += cell.attempts;
    bySubjectBatch.set(key, bucket);
  }

  const heatmapBatches = comparison.map((b) => ({ id: b.batchId, name: b.name }));
  const heatmapRows: SubjectHeatmapRow[] = [...subjects]
    .sort((a, b) => a.localeCompare(b))
    .map((subject) => ({
      subject,
      cells: heatmapBatches.map((batch) => {
        const bucket = bySubjectBatch.get(`${batch.id}|||${subject}`);
        return {
          batchId: batch.id,
          accuracy: bucket ? Math.round((bucket.total / bucket.count) * 10) / 10 : null,
          attempts: bucket?.attempts ?? 0,
        };
      }),
    }));

  const overallAverage = average(studentRows.map((s) => s.meanPercentage));

  return {
    available: studentScores.length > 0,
    kpis: {
      totalStudents: studyTime.students,
      activeBatches: activeBatches.length,
      averagePercentage: roundOrNull(overallAverage),
      testsConducted,
      weakTopics,
      averageStudyMinutes: roundOrNull(studyTime.averageMinutes),
    },
    batches: comparison,
    topPerformers,
    atRisk,
    heatmap: { batches: heatmapBatches, rows: heatmapRows },
    scoreDistribution: scoreBuckets(studentRows.map((s) => s.meanPercentage)),
    rankedStudents: studentRows.length,
  };
}

/**
 * Per-batch score stats for the batch-list cards. One OGCODE query for every
 * batch, degrading to an empty map — the cards still render their roster
 * information when analytics is unavailable.
 */
export async function getBatchScoreStatsSafe(
  workspaceId: string,
): Promise<Map<string, BatchScoreStats>> {
  return safe(
    () => getWorkspaceBatchScoreStats(workspaceId),
    new Map<string, BatchScoreStats>(),
    "batch score stats",
  );
}

// ─── Batch deep-dive ──────────────────────────────────────────────────────────

export type BatchSummaryAnalytics = {
  available: boolean;
  averagePercentage: number | null;
  topPercentage: number | null;
  lowestPercentage: number | null;
  medianPercentage: number | null;
  rankedStudents: number;
  weakTopics: number;
  scoreDistribution: ScoreBucket[];
};

/**
 * Batch summary + score distribution, derived IN APP CODE from the leaderboard
 * the batch already loads (D4) — it returns every student's mean, so a second
 * SQL aggregate would be a duplicate source of truth for the same numbers.
 */
export function summariseBatchLeaderboard(
  leaderboard: readonly BatchLeaderboardEntryLite[],
  topics: readonly BatchTopicSnapshotLite[],
): BatchSummaryAnalytics {
  const means = leaderboard.map((entry) => entry.meanPercentage);
  return {
    available: leaderboard.length > 0,
    averagePercentage: roundOrNull(average(means)),
    topPercentage: means.length ? roundOrNull(Math.max(...means)) : null,
    lowestPercentage: means.length ? roundOrNull(Math.min(...means)) : null,
    medianPercentage: roundOrNull(median(means)),
    rankedStudents: leaderboard.length,
    weakTopics: topics.filter((t) => t.severity === "high" && !t.covered).length,
    scoreDistribution: scoreBuckets(means),
  };
}

export type BatchDeepAnalytics = {
  summary: BatchSummaryAnalytics;
  topics: BatchTopicSnapshotLite[];
  leaderboard: BatchLeaderboardEntryLite[];
  timeline: BatchTimelinePoint[];
};

/** Batch Analytics tab payload: summary, topics, ranking, and timeline. */
export async function getBatchDeepAnalytics(
  workspaceId: string,
  batchId: string,
): Promise<BatchDeepAnalytics> {
  const [leaderboard, topics, timeline] = await Promise.all([
    safe(() => getBatchLeaderboardLive(workspaceId, batchId), [], "batch leaderboard"),
    safe(() => getBatchTopicAccuracyLive(workspaceId, batchId), [], "batch topics"),
    safe(() => getBatchTestTimelineLive(workspaceId, batchId), [], "batch timeline"),
  ]);
  const sortedTopics = [...topics].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.accuracy - b.accuracy,
  );
  return {
    summary: summariseBatchLeaderboard(leaderboard, topics),
    topics: sortedTopics,
    leaderboard,
    timeline,
  };
}

// ─── Batch leaderboards (performers + practitioners) ──────────────────────────

export type BatchLeaderboards = {
  /** Ranked on TESTS the batch has sat — outcome. */
  performers: BatchLeaderboardEntryLite[];
  /** Ranked on PRACTICE — the teacher's shared DPPs plus OG Code — effort. */
  practitioners: PracticeLeaderboardEntry[];
  practiceSummary: PracticeLeaderboardSummary;
  /** Which key the practitioner board was ranked on. */
  basis: PracticeRankBasis;
  /** False when teacherDppShare is off — the UI hides the practice half. */
  practiceEnabled: boolean;
};

/**
 * Both boards for one batch.
 *
 * They are deliberately two separate rankings rather than one blended score:
 * test performance and practice effort answer different questions, and the
 * student a teacher most wants to find is usually the one who ranks high on one
 * and low on the other. Collapsing them would hide exactly that contrast.
 *
 * The batch roster comes from the USER pool and is passed into the practice
 * query, which runs entirely in the OGCODE pool — no cross-pool join.
 */
export async function getBatchLeaderboards(
  workspaceId: string,
  batchId: string,
  basis: PracticeRankBasis = "combined",
): Promise<BatchLeaderboards> {
  const practiceEnabled = isFeatureEnabled("teacherDppShare");

  const [performers, members] = await Promise.all([
    safe(() => getBatchLeaderboardLive(workspaceId, batchId), [], "batch leaderboard"),
    practiceEnabled
      ? safe(() => listBatchMembers(workspaceId, batchId), [], "batch members")
      : Promise.resolve([]),
  ]);

  const practiceRows = practiceEnabled
    ? await safe(
        () =>
          getBatchPracticeLeaderboardLive(
            workspaceId,
            batchId,
            members.map((member) => member.studentId),
          ),
        [],
        "batch practice leaderboard",
      )
    : [];

  const practitioners = rankPractitioners(practiceRows, basis);

  return {
    performers,
    practitioners,
    practiceSummary: summarisePractice(practitioners),
    basis,
    practiceEnabled,
  };
}

/** One row of the batch ranking table — leaderboard ⋈ mastery ⋈ engagement. */
export type BatchRosterRow = BatchLeaderboardEntryLite & {
  /** Mean TOPIC accuracy 0–100 — a different question from `meanPercentage`. */
  accuracy: number | null;
  /** BKT mastery 0–100 for display. */
  mastery: number | null;
  /** Topics analytics-service flagged as anomalous. */
  anomalousTopics: number;
  streak: number;
  studyMinutes: number;
  points: number;
};

/**
 * Batch ranking table rows: the leaderboard (OGCODE) merged with per-student
 * engagement (USER). Topic accuracy comes from the batch topic rows the caller
 * already has, so no extra per-student query is issued.
 */
export async function getBatchRoster(
  workspaceId: string,
  batchId: string,
): Promise<BatchRosterRow[]> {
  const leaderboard = await safe(
    () => getBatchLeaderboardLive(workspaceId, batchId),
    [] as BatchLeaderboardEntryLite[],
    "batch leaderboard",
  );
  if (leaderboard.length === 0) return [];
  const ids = leaderboard.map((entry) => entry.studentId);
  const [streaks, points, activity, mastery] = await Promise.all([
    safe(() => getStreaksForStudents(ids), new Map<string, StudentStreak>(), "streaks"),
    safe(() => getPointsForStudents(ids), new Map(), "points"),
    safe(() => getDailyActivityForStudents(ids, 30), [], "daily activity"),
    safe(
      () => getBatchStudentMasteryLive(workspaceId, batchId),
      new Map<string, BatchStudentMastery>(),
      "batch student mastery",
    ),
  ]);
  const minutesById = new Map<string, number>();
  for (const row of activity) {
    const minutes = row.webpageTime + row.practiceTime + row.pomodoroTime;
    minutesById.set(row.studentId, (minutesById.get(row.studentId) ?? 0) + minutes);
  }
  return leaderboard.map((entry) => {
    const row = mastery.get(entry.studentId);
    return {
      ...entry,
      accuracy: row ? row.topicAccuracy : null,
      mastery: row ? Math.round(row.mastery * 1000) / 10 : null,
      anomalousTopics: row?.anomalousTopics ?? 0,
      streak: streaks.get(entry.studentId)?.currentStreak ?? 0,
      studyMinutes: minutesById.get(entry.studentId) ?? 0,
      points: points.get(entry.studentId)?.totalPoints ?? 0,
    };
  });
}

// ─── Student 360° ─────────────────────────────────────────────────────────────

export type StudentDeepProfile = {
  student: DirectoryStudentRow;
  kpis: {
    averagePercentage: number | null;
    bestPercentage: number | null;
    worstPercentage: number | null;
    testsTaken: number;
    questionsPracticed: number;
    accuracyRate: number | null;
  };
  scoreTrend: Array<{ date: string; percentage: number; title: string }>;
  subjects: StudentSubjectAccuracy[];
  topics: StudentTopicProfileLite[];
  strengths: StudentTopicProfileLite[];
  weaknesses: StudentTopicProfileLite[];
  testHistory: StudentTestHistoryEntry[];
  timeAnalytics: Array<{
    date: string;
    dayName: string;
    webpageTime: number;
    practiceTime: number;
    pomodoroTime: number;
  }>;
  contributions: Array<{ date: string; count: number }>;
  streak: StudentStreak | null;
  points: number;
  latestAnalysis: { summary: string; recommendations: string[]; testTitle: string } | null;
  /** Shared-DPP + OG Code practice record — effort alongside outcome. */
  practice: StudentPracticeProfile;
};

/** How many days the 360° contribution grid covers. */
const CONTRIBUTION_DAYS = 182;

/**
 * The full 360° profile for one student inside one workspace.
 *
 * Authorisation note: the caller has already passed `requireWorkspaceMember`,
 * and `getDirectoryStudent` returns null unless the student is ENROLLED in this
 * workspace — so a teacher cannot read a student who is not theirs (ledger #15).
 * The student's social privacy flag governs the public /u/ profile only and is
 * deliberately not consulted here (ledger #16); no social fields are exposed.
 */
export async function getStudentDeepProfile(
  workspaceId: string,
  studentId: string,
): Promise<StudentDeepProfile | null> {
  const student = await getDirectoryStudent(workspaceId, studentId);
  if (!student) return null;

  const emptyPractice: StudentPracticeProfile = {
    dppsAttempted: 0,
    questionsAttempted: 0,
    dppScore: 0,
    dppTotalMarks: 0,
    dppAccuracy: null,
    ogcodeScore: 0,
    ogcodeQuestions: 0,
    history: [],
  };
  const [testHistory, subjects, topics, activity, streaks, points, practice] = await Promise.all([
    safe(() => getStudentTestHistoryLive(workspaceId, studentId), [], "student test history"),
    safe(() => getStudentSubjectAccuracyLive(workspaceId, studentId), [], "student subjects"),
    safe(() => getStudentTopicProfileLive(workspaceId, studentId), [], "student topics"),
    safe(() => getDailyActivityForStudents([studentId], CONTRIBUTION_DAYS), [], "daily activity"),
    safe(() => getStreaksForStudents([studentId]), new Map<string, StudentStreak>(), "streaks"),
    safe(() => getPointsForStudents([studentId]), new Map(), "points"),
    isFeatureEnabled("teacherDppShare")
      ? safe(
          () => getStudentPracticeProfileLive(workspaceId, studentId),
          emptyPractice,
          "student practice",
        )
      : Promise.resolve(emptyPractice),
  ]);

  const percentages = testHistory.map((t) => t.percentage);
  const questionsPracticed = topics.reduce((sum, t) => sum + t.totalAttempts, 0);
  const correctAttempts = topics.reduce((sum, t) => sum + t.correctAttempts, 0);

  // Dense 7-day series so a zero-activity day renders as a gap, not a missing bar.
  const activityByDate = new Map(activity.map((row) => [row.date, row]));
  const timeAnalytics = istDateStrings(7).map((date) => {
    const row = activityByDate.get(date);
    return {
      date,
      dayName: weekdayLabel(date),
      webpageTime: row?.webpageTime ?? 0,
      practiceTime: row?.practiceTime ?? 0,
      pomodoroTime: row?.pomodoroTime ?? 0,
    };
  });

  const contributions = istDateStrings(CONTRIBUTION_DAYS).map((date) => ({
    date,
    count: activityByDate.get(date)?.questionsPracticed ?? 0,
  }));

  const byAccuracy = [...topics].sort((a, b) => b.accuracy - a.accuracy);
  const withAttempts = byAccuracy.filter((t) => t.totalAttempts > 0);
  const latest = testHistory.find((t) => t.summary || t.recommendations.length > 0) ?? null;

  return {
    student,
    practice,
    kpis: {
      averagePercentage: roundOrNull(average(percentages)),
      bestPercentage: percentages.length ? roundOrNull(Math.max(...percentages)) : null,
      worstPercentage: percentages.length ? roundOrNull(Math.min(...percentages)) : null,
      testsTaken: testHistory.length,
      questionsPracticed,
      accuracyRate:
        questionsPracticed > 0
          ? Math.round((correctAttempts / questionsPracticed) * 1000) / 10
          : null,
    },
    // Oldest-first for the trend line; history itself stays newest-first.
    scoreTrend: [...testHistory]
      .reverse()
      .map((t) => ({ date: t.submittedAt, percentage: t.percentage, title: t.title })),
    subjects,
    topics,
    strengths: withAttempts.slice(0, 5),
    weaknesses: [...withAttempts].reverse().slice(0, 5),
    testHistory,
    timeAnalytics,
    contributions,
    streak: streaks.get(studentId) ?? null,
    points: points.get(studentId)?.totalPoints ?? 0,
    latestAnalysis: latest
      ? {
          summary: latest.summary ?? "",
          recommendations: latest.recommendations,
          testTitle: latest.title,
        }
      : null,
  };
}

// ─── Student directory ────────────────────────────────────────────────────────

export type DirectoryStudentWithMetrics = DirectoryStudentRow & {
  meanPercentage: number | null;
  attempts: number;
  lastAttemptAt: string | null;
};

export type DirectoryResult = {
  rows: DirectoryStudentWithMetrics[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * The student directory page: roster (USER) merged with performance (OGCODE).
 *
 * When the requested sort is a cross-pool metric the store cannot ORDER BY it in
 * SQL, so it returns every matching row (capped) and the sort + slice happen
 * here after the merge.
 */
export async function listDirectoryStudents(
  query: StudentDirectoryQuery,
): Promise<DirectoryResult> {
  const provider = getStudentSearchProvider();
  const [page, scores] = await Promise.all([
    provider.search(query),
    safe(() => getWorkspaceStudentScores(query.workspaceId), [], "student scores"),
  ]);

  const scoreById = new Map(scores.map((s) => [s.studentId, s]));
  let rows: DirectoryStudentWithMetrics[] = page.rows.map((row) => {
    const score = scoreById.get(row.studentId);
    return {
      ...row,
      meanPercentage: score ? Math.round(score.meanPercentage * 10) / 10 : null,
      attempts: score?.attempts ?? 0,
      lastAttemptAt: score?.lastAttemptAt ?? null,
    };
  });

  if (page.requiresMetricSort) {
    const dir = query.direction === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const left = query.sort === "attempts" ? a.attempts : a.meanPercentage;
      const right = query.sort === "attempts" ? b.attempts : b.meanPercentage;
      // Students with no submissions always sink to the bottom, in BOTH
      // directions — "worst first" means worst *scoring*, not "no data first".
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return (left - right) * dir;
    });
    const start = (page.page - 1) * page.pageSize;
    rows = rows.slice(start, start + page.pageSize);
  }

  return { rows, total: page.total, page: page.page, pageSize: page.pageSize };
}

function roundOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}
