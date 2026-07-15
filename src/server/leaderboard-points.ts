/**
 * Prestige-points global leaderboard (Phase 2).
 *
 * The "national rank / AIR" and the overall Hall-of-Fame board rank students by
 * their total prestige points (`app.user_scores.data->>'totalPoints'`), which
 * already aggregates speed-weighted OG-Code first-solves, test points, and AI
 * sessions. This replaces the old efficiency formula
 * (`SUM(correct)/study_minutes` over `analytics.test_results`) that ignored
 * OG-Code practice entirely and contradicted the OG-Code scoring modal.
 *
 * Subject "arena" boards are unchanged (still efficiency-based) — this module
 * only backs the overall/global + regional views.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

export type PointsLeaderboardEntry = {
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  location: string | null;
  points: number;
  /** Alias so existing UI that reads `score` shows prestige points. */
  score: number;
  /** Alias so existing UI that reads `rankScore` shows prestige points. */
  rankScore: number;
  studyTime: number;
  streak: number;
  rank: number;
  isMe: boolean;
  is_me: boolean;
};

export type PointsLeaderboardResult = {
  leaderboard: PointsLeaderboardEntry[];
  myRank: number | null;
  my_rank: number | null;
  myPoints: number;
};

/** A row already ranked by SQL `RANK() OVER (ORDER BY points DESC)`. */
export type RankedPointsRow = {
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  location: string | null;
  points: number;
  studyTime: number;
  streak: number;
  rank: number;
};

/**
 * Pure assembly of the leaderboard payload from pre-ranked rows: take the top N,
 * always include the viewer's own row (so a low-ranked student still sees their
 * position), and resolve the viewer's rank/points. Kept pure for unit testing.
 */
export function buildPointsLeaderboardResult(
  rankedRows: readonly RankedPointsRow[],
  meId: string,
  topN: number,
): PointsLeaderboardResult {
  const toEntry = (row: RankedPointsRow): PointsLeaderboardEntry => ({
    userId: row.userId,
    name: row.name,
    username: row.username,
    avatar: row.avatar,
    location: row.location,
    points: row.points,
    score: row.points,
    rankScore: row.points,
    studyTime: row.studyTime,
    streak: row.streak,
    rank: row.rank,
    isMe: row.userId === meId,
    is_me: row.userId === meId,
  });

  const top = rankedRows.slice(0, Math.max(0, topN)).map(toEntry);
  const meRow = rankedRows.find((row) => row.userId === meId);
  if (meRow && !top.some((entry) => entry.userId === meId)) {
    top.push(toEntry(meRow));
  }

  return {
    leaderboard: top,
    myRank: meRow?.rank ?? null,
    my_rank: meRow?.rank ?? null,
    myPoints: meRow?.points ?? 0,
  };
}

const EMPTY_RESULT: PointsLeaderboardResult = {
  leaderboard: [],
  myRank: null,
  my_rank: null,
  myPoints: 0,
};

type RawRankRow = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  location: string | null;
  points: number | string | null;
  total_study_time: number | string | null;
  streak: number | string | null;
  rank: number | string;
};

function toRankedRow(row: RawRankRow): RankedPointsRow {
  return {
    userId: row.user_id,
    name: row.name ?? "Unknown",
    username: row.username ?? null,
    avatar: row.avatar ?? null,
    location: row.location ?? null,
    points: Math.max(0, Math.round(Number(row.points ?? 0))),
    studyTime: Math.max(0, Math.round(Number(row.total_study_time ?? 0))),
    streak: Math.max(0, Math.round(Number(row.streak ?? 0))),
    rank: Number(row.rank),
  };
}

/**
 * Global (or regional, when `location` is set) leaderboard ranked by total
 * prestige points. Students with no `user_scores` row (zero activity) are
 * omitted; the viewer's rank falls back to `null` in that case.
 */
export async function getGlobalPointsLeaderboard(
  userId: string,
  location?: string | null,
  topN = 100,
): Promise<PointsLeaderboardResult> {
  const pool = getUserPostgresPool();
  if (!pool) return { ...EMPTY_RESULT };

  const points = `COALESCE((s.data->>'totalPoints')::numeric, 0)`;
  const baseSelect = `
    SELECT
      s.user_id,
      u.name,
      u.username,
      u.avatar,
      #LOCATION_COL#
      ${points} AS points,
      u.total_study_time,
      u.streak,
      RANK() OVER (ORDER BY ${points} DESC) AS rank
    FROM app.user_scores s
    JOIN origin_users u ON u.id = s.user_id
    WHERE u.role = 'student'
  `;

  const withLocationCol = (hasLocation: boolean) =>
    baseSelect.replace("#LOCATION_COL#", hasLocation ? "u.location," : "NULL::text AS location,");

  let rows: RawRankRow[];
  try {
    const sql = location
      ? `${withLocationCol(true)} AND u.location = $1`
      : withLocationCol(true);
    const result = await pool.query<RawRankRow>(sql, location ? [location] : []);
    rows = result.rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Older DBs may not have the `location` column — retry without it, unless
    // a regional board was explicitly requested (then it's genuinely empty).
    if (message.includes('column "location"') || message.includes("location does not exist")) {
      if (location) return { ...EMPTY_RESULT };
      const result = await pool.query<RawRankRow>(withLocationCol(false));
      rows = result.rows;
    } else {
      console.error("[getGlobalPointsLeaderboard] query failed:", message);
      return { ...EMPTY_RESULT };
    }
  }

  return buildPointsLeaderboardResult(rows.map(toRankedRow), userId, topN);
}
