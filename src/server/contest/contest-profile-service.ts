/**
 * Student contest profile + global ORBIT leaderboard — the read-side surfaces
 * for data the pipeline already produces but never showed: ORBIT rating,
 * per-contest rating history, badges/streaks/personal-bests, and total OGCode
 * rewards. Plus the all-time ORBIT ranking across all contestants.
 *
 * All reads via the replica; safe for on-demand student pages.
 */

import { getUserPostgresReplicaPool } from "@/server/user-postgres";

import { getOrbitSummary, type OrbitSummary } from "./contest-orbit-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresReplicaPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface ContestHistoryRow {
  contestId: string;
  name: string;
  rank: number | null;
  percentile: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  createdAt: string;
}

export interface ContestProfile {
  orbit: OrbitSummary | null;
  streak: { current: number; longest: number };
  badges: { badge: string; contestId: string | null; awardedAt: string }[];
  personalBest: { highestOrbit: number | null; bestRank: number | null; bestPercentile: number | null } | null;
  totalRewardPoints: number;
  contestsPlayed: number;
  history: ContestHistoryRow[];
}

/** Everything a student's "My Contests / ORBIT" surface needs, in one round. */
export async function getContestProfile(userId: string): Promise<ContestProfile> {
  await ensureContestSchema();
  const p = pool();

  const [orbit, streakRes, badgesRes, pbRes, rewardRes, historyRes, playedRes] = await Promise.all([
    getOrbitSummary(userId).catch(() => null),
    p.query<{ current_streak: number; longest_streak: number }>(
      `SELECT current_streak, longest_streak FROM contest.streaks WHERE user_id = $1`,
      [userId],
    ),
    p.query<{ badge: string; contest_id: string | null; awarded_at: string }>(
      `SELECT badge, contest_id, awarded_at FROM contest.badges WHERE user_id = $1 ORDER BY awarded_at DESC`,
      [userId],
    ),
    p.query<{ highest_orbit: number | null; best_rank: number | null; best_percentile: number | null }>(
      `SELECT highest_orbit, best_rank, best_percentile FROM contest.personal_bests WHERE user_id = $1`,
      [userId],
    ),
    p.query<{ total: number | null }>(
      `SELECT COALESCE(SUM(ogcode_points), 0)::int AS total FROM contest.reward_ledger WHERE user_id = $1`,
      [userId],
    ),
    p.query<{
      contest_id: string; name: string; rank: number | null; percentile: number | null;
      rating_before: number | null; rating_after: number | null; rating_change: number | null; created_at: string;
    }>(
      `SELECT h.contest_id, c.name, h.rank, h.percentile,
              h.rating_before, h.rating_after, h.rating_change, h.created_at
         FROM contest.orbit_history h
         JOIN contest.contests c ON c.id = h.contest_id
        WHERE h.user_id = $1
        ORDER BY h.created_at DESC
        LIMIT 50`,
      [userId],
    ),
    p.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM contest.attempts WHERE user_id = $1 AND finished_at IS NOT NULL`,
      [userId],
    ),
  ]);

  return {
    orbit,
    streak: {
      current: streakRes.rows[0]?.current_streak ?? 0,
      longest: streakRes.rows[0]?.longest_streak ?? 0,
    },
    badges: badgesRes.rows.map((r) => ({
      badge: r.badge,
      contestId: r.contest_id,
      awardedAt: new Date(r.awarded_at).toISOString(),
    })),
    personalBest: pbRes.rows[0]
      ? { highestOrbit: pbRes.rows[0].highest_orbit, bestRank: pbRes.rows[0].best_rank, bestPercentile: pbRes.rows[0].best_percentile }
      : null,
    totalRewardPoints: rewardRes.rows[0]?.total ?? 0,
    contestsPlayed: playedRes.rows[0]?.n ?? 0,
    history: historyRes.rows.map((r) => ({
      contestId: r.contest_id,
      name: r.name,
      rank: r.rank,
      percentile: r.percentile,
      ratingBefore: r.rating_before != null ? Math.round(r.rating_before) : null,
      ratingAfter: r.rating_after != null ? Math.round(r.rating_after) : null,
      ratingChange: r.rating_change != null ? Math.round(r.rating_change) : null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

export interface OrbitLeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  rating: number;
  tier: string;
  provisional: boolean;
  gamesPlayed: number;
}

/**
 * Global all-time ORBIT leaderboard, ordered by (rating desc, user_id) and paged
 * by a simple row-number cursor. Only non-provisional raters with ≥1 game are
 * ranked (a provisional high-RD seed shouldn't top the board).
 */
export async function getOrbitLeaderboard(opts: { cursor?: number | null; limit?: number } = {}): Promise<{
  rows: OrbitLeaderRow[];
  nextCursor: number | null;
}> {
  await ensureContestSchema();
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const after = opts.cursor != null && Number.isFinite(opts.cursor) ? Math.trunc(opts.cursor) : 0;
  const p = pool();

  const res = await p.query<{
    rn: number; user_id: string; name: string | null; current_rating: number; games_played: number;
  }>(
    `WITH ranked AS (
       SELECT r.user_id, u.name, r.current_rating, r.games_played,
              ROW_NUMBER() OVER (ORDER BY r.current_rating DESC, r.user_id ASC) AS rn
         FROM contest.orbit_ratings r
         JOIN origin_users u ON u.id = r.user_id
        WHERE r.games_played > 0 AND r.rd < 210
     )
     SELECT * FROM ranked WHERE rn > $1 ORDER BY rn ASC LIMIT $2`,
    [after, limit + 1],
  );

  const page = res.rows.slice(0, limit);
  const hasMore = res.rows.length > limit;
  const { orbitTier } = await import("@/lib/contest/glicko2");

  const rows: OrbitLeaderRow[] = page.map((r) => ({
    rank: Number(r.rn),
    userId: r.user_id,
    displayName: (r.name ?? "Scholar").trim().split(/\s+/)[0],
    rating: Math.round(r.current_rating),
    tier: orbitTier(r.current_rating),
    provisional: false,
    gamesPlayed: r.games_played,
  }));

  return { rows, nextCursor: hasMore && page.length ? Number(page[page.length - 1].rn) : null };
}
