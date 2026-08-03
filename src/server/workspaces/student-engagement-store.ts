/**
 * Study-engagement signals for a teacher's students — study-time split, the
 * contribution grid, streaks, and prestige points.
 * (Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md §1.3)
 *
 * POOL: USER only. `app.daily_activities`, `app.streaks` and `app.user_scores`
 * are written by src/server/gamification.ts through the app-store collection
 * writer, so every row is `(id, user_id, activity_date, subject, completed,
 * data JSONB, …)` where `data` is the serialised Stored* object.
 *
 * Why not `readStoreAsync()`: that hydrates EVERY user's rows for the whole
 * platform into memory (it is what /u/<username> uses). A teacher dashboard must
 * not pay that cost, so these read the same tables with the ids scoped to one
 * batch/workspace — driven by idx_daily_activities_user_date.
 *
 * All dates are the IST day-strings gamification wrote (see teacher-analytics
 * `istDateStrings`); they are returned verbatim and never re-derived from UTC.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * SQL fragment resolving a row's day: prefer the indexed `activity_date`
 * column, fall back to `data->>'date'` for legacy rows written before the
 * column existed (ledger #9). The regex guard keeps a malformed legacy value
 * from aborting the whole query with an invalid-date cast.
 */
const DAY_EXPR = `COALESCE(
  activity_date,
  CASE WHEN data->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       THEN (data->>'date')::date END
)`;

export type DailyActivityRow = {
  studentId: string;
  /** IST calendar date, `YYYY-MM-DD`. */
  date: string;
  questionsPracticed: number;
  /** Minutes. */
  webpageTime: number;
  practiceTime: number;
  pomodoroTime: number;
};

/**
 * Daily activity rows for a set of students over a trailing window.
 *
 * The window is widened by one day on the server because `CURRENT_DATE` is UTC
 * while the stored dates are IST — the caller slices to the exact IST window it
 * wants. Returns [] for an empty id list without touching the database.
 */
export async function getDailyActivityForStudents(
  studentIds: readonly string[],
  days: number,
): Promise<DailyActivityRow[]> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const windowDays = Math.min(Math.max(Math.floor(days), 1), 400) + 1;
  // `day` is formatted to TEXT in SQL on purpose: node-postgres parses a DATE
  // into a local-midnight JS Date, so `toISOString()` would shift the calendar
  // day on any server not at UTC+0 — silently corrupting the contribution grid.
  const result = await pool().query(
    `WITH activity AS (
       SELECT user_id,
              ${DAY_EXPR} AS day,
              COALESCE((data->>'questionsPracticed')::numeric, 0) AS questions_practiced,
              COALESCE((data->>'webpageTime')::numeric, 0)        AS webpage_time,
              COALESCE((data->>'practiceTime')::numeric, 0)       AS practice_time,
              COALESCE((data->>'pomodoroTime')::numeric, 0)       AS pomodoro_time
         FROM app.daily_activities
        WHERE user_id = ANY($1::text[])
     )
     SELECT user_id,
            TO_CHAR(day, 'YYYY-MM-DD') AS day,
            questions_practiced, webpage_time, practice_time, pomodoro_time
       FROM activity
      WHERE day IS NOT NULL
        AND day >= (CURRENT_DATE - $2::int)
      ORDER BY day ASC`,
    [ids, windowDays],
  );
  return result.rows.map((row) => ({
    studentId: row.user_id as string,
    date: String(row.day ?? ""),
    questionsPracticed: Number(row.questions_practiced) || 0,
    webpageTime: Number(row.webpage_time) || 0,
    practiceTime: Number(row.practice_time) || 0,
    pomodoroTime: Number(row.pomodoro_time) || 0,
  }));
}

export type StudentStreak = {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  /** Seven booleans, Monday-index-free — exactly as gamification stores them. */
  weeklyData: boolean[];
  freezesRemaining: number | null;
};

/** Streak records for a set of students, keyed by student id. */
export async function getStreaksForStudents(
  studentIds: readonly string[],
): Promise<Map<string, StudentStreak>> {
  const map = new Map<string, StudentStreak>();
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return map;
  const result = await pool().query(
    `SELECT user_id, data FROM app.streaks WHERE user_id = ANY($1::text[])`,
    [ids],
  );
  for (const row of result.rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const weekly = Array.isArray(data.weeklyData) ? (data.weeklyData as unknown[]) : [];
    map.set(row.user_id as string, {
      currentStreak: Number(data.currentStreak) || 0,
      longestStreak: Number(data.longestStreak) || 0,
      lastStudyDate: typeof data.lastStudyDate === "string" ? data.lastStudyDate : null,
      // Normalise to exactly 7 booleans so the UI can index it without guards.
      weeklyData: Array.from({ length: 7 }, (_, i) => Boolean(weekly[i])),
      freezesRemaining: Number.isFinite(Number(data.freezesRemaining))
        ? Number(data.freezesRemaining)
        : null,
    });
  }
  return map;
}

export type StudentPoints = { totalPoints: number; currentTier: string | null };

/** Prestige points + tier for a set of students, keyed by student id. */
export async function getPointsForStudents(
  studentIds: readonly string[],
): Promise<Map<string, StudentPoints>> {
  const map = new Map<string, StudentPoints>();
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return map;
  const result = await pool().query(
    `SELECT user_id, data FROM app.user_scores WHERE user_id = ANY($1::text[])`,
    [ids],
  );
  for (const row of result.rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    map.set(row.user_id as string, {
      totalPoints: Number(data.totalPoints) || 0,
      currentTier: typeof data.currentTier === "string" ? data.currentTier : null,
    });
  }
  return map;
}

/** Aggregate engagement for a set of students — one row per student. */
export type StudentEngagementSummary = {
  studentId: string;
  /** Sum of questions practised inside the window. */
  questionsPracticed: number;
  /** Total study minutes (practice + pomodoro + webpage) inside the window. */
  activeMinutes: number;
  /** Distinct days with any recorded activity inside the window. */
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
};

/**
 * One-call engagement rollup for a roster (directory rows, batch ranking table).
 * Runs the three reads in parallel and folds them into a single map.
 */
export async function getEngagementSummaries(
  studentIds: readonly string[],
  windowDays = 30,
): Promise<Map<string, StudentEngagementSummary>> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  const summaries = new Map<string, StudentEngagementSummary>();
  if (ids.length === 0) return summaries;

  const [activity, streaks, points] = await Promise.all([
    getDailyActivityForStudents(ids, windowDays),
    getStreaksForStudents(ids),
    getPointsForStudents(ids),
  ]);

  for (const id of ids) {
    summaries.set(id, {
      studentId: id,
      questionsPracticed: 0,
      activeMinutes: 0,
      activeDays: 0,
      currentStreak: streaks.get(id)?.currentStreak ?? 0,
      longestStreak: streaks.get(id)?.longestStreak ?? 0,
      totalPoints: points.get(id)?.totalPoints ?? 0,
    });
  }

  for (const row of activity) {
    const summary = summaries.get(row.studentId);
    if (!summary) continue;
    const minutes = row.webpageTime + row.practiceTime + row.pomodoroTime;
    summary.questionsPracticed += row.questionsPracticed;
    summary.activeMinutes += minutes;
    if (minutes > 0 || row.questionsPracticed > 0) summary.activeDays += 1;
  }

  return summaries;
}
