/**
 * Contest gamification persistence (plan Phase 8). Computed off a PUBLISHED
 * contest's leaderboard: awards badges, advances the participation streak, and
 * updates personal-bests for every ranked user. Idempotent per contest: badges
 * are UNIQUE(user_id, badge) and the streak advance is guarded by a marker so a
 * re-run doesn't double-count.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import {
  badgesForResult,
  mergePersonalBests,
  type ContestBadge,
} from "@/lib/contest/gamification";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface GamificationResult {
  contestId: string;
  processed: number;
}

/**
 * Apply gamification for a published contest. Reads the leaderboard snapshot +
 * per-user attempt/orbit data, then upserts badges + personal_bests and bumps
 * streaks. Idempotent: a per-contest streak marker (contest.streaks.last_contest_id)
 * prevents a re-run from advancing the streak twice.
 */
export async function applyContestGamification(contestId: string): Promise<GamificationResult> {
  await ensureContestSchema();
  const p = pool();

  // The ranked field joined to attempt + orbit-history data for this contest.
  const rows = await p.query<{
    user_id: string;
    rank: number;
    percentile: string;
    total: number;
    correct: number;
    incorrect: number;
    time_taken: number | null;
    median_time: number | null;
    orbit_after: number | null;
    orbit_change: number | null;
  }>(
    `WITH stats AS (
        SELECT COUNT(*)::int AS total,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_taken_seconds) AS median_time
          FROM contest.leaderboard_snapshot WHERE contest_id = $1
      )
      SELECT b.user_id, b.rank, b.percentile, stats.total,
             a.correct_count AS correct, a.incorrect_count AS incorrect,
             b.time_taken_seconds AS time_taken, stats.median_time,
             h.rating_after AS orbit_after, h.rating_change AS orbit_change
        FROM contest.leaderboard_snapshot b
        CROSS JOIN stats
        JOIN contest.attempts a ON a.contest_id = $1 AND a.user_id = b.user_id
        LEFT JOIN contest.orbit_history h ON h.contest_id = $1 AND h.user_id = b.user_id
       WHERE b.contest_id = $1`,
    [contestId],
  );

  let processed = 0;
  for (const r of rows.rows) {
    const orbitAfter = r.orbit_after != null ? Number(r.orbit_after) : 1000;
    const orbitChange = r.orbit_change != null ? Number(r.orbit_change) : 0;
    const timeVsMedian =
      r.time_taken != null && r.median_time && Number(r.median_time) > 0
        ? Number(r.time_taken) / Number(r.median_time)
        : null;

    const badges: ContestBadge[] = badgesForResult({
      rank: r.rank,
      percentile: Number(r.percentile),
      totalRanked: r.total,
      correct: r.correct ?? 0,
      incorrect: r.incorrect ?? 0,
      timeVsMedian,
      orbitAfter,
      orbitChange,
    });

    const client = await p.connect();
    try {
      await client.query("BEGIN");

      for (const badge of badges) {
        await client.query(
          `INSERT INTO contest.badges (user_id, badge, contest_id)
           VALUES ($1, $2, $3) ON CONFLICT (user_id, badge) DO NOTHING`,
          [r.user_id, badge, contestId],
        );
      }

      // Streak: advance once per contest (guarded by last_contest_id).
      await client.query(
        `INSERT INTO contest.streaks (user_id, current_streak, longest_streak, last_contest_id)
         VALUES ($1, 1, 1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           current_streak = CASE
             WHEN contest.streaks.last_contest_id = $2 THEN contest.streaks.current_streak
             ELSE contest.streaks.current_streak + 1 END,
           longest_streak = GREATEST(
             contest.streaks.longest_streak,
             CASE WHEN contest.streaks.last_contest_id = $2 THEN contest.streaks.current_streak
                  ELSE contest.streaks.current_streak + 1 END),
           last_contest_id = $2,
           updated_at = NOW()`,
        [r.user_id, contestId],
      );

      // Personal bests.
      const pbRow = await client.query(
        `SELECT highest_orbit, best_rank, best_percentile FROM contest.personal_bests WHERE user_id = $1`,
        [r.user_id],
      );
      const merged = mergePersonalBests(
        {
          highestOrbit: pbRow.rows[0]?.highest_orbit != null ? Number(pbRow.rows[0].highest_orbit) : null,
          bestRank: pbRow.rows[0]?.best_rank ?? null,
          bestPercentile: pbRow.rows[0]?.best_percentile != null ? Number(pbRow.rows[0].best_percentile) : null,
        },
        { orbitAfter, rank: r.rank, percentile: Number(r.percentile) },
      );
      await client.query(
        `INSERT INTO contest.personal_bests (user_id, highest_orbit, best_rank, best_percentile)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           highest_orbit = $2, best_rank = $3, best_percentile = $4, updated_at = NOW()`,
        [r.user_id, merged.highestOrbit, merged.bestRank, merged.bestPercentile],
      );

      await client.query("COMMIT");
      processed += 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return { contestId, processed };
}
