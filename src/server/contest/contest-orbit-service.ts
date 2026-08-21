/**
 * ORBIT rating batch (plan Phase 7). After a contest's leaderboard is
 * materialized, update every eligible participant's persistent ORBIT rating with
 * one Glicko-2 period (percentile vs the field). O(N): one virtual game per
 * player against the field's mean.
 *
 * Idempotent + replayable: guarded by contest.orbit_history keyed
 * (user_id, contest_id) — if a row exists for this contest, the batch is a
 * no-op. On a later flag-clear a caller can delete the history row(s) and re-run
 * to recompute from the immutable snapshots. No-shows (no eligible attempt) get
 * no rating change (D2).
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import {
  applyContest,
  seedRating,
  type Glicko2State,
} from "@/lib/contest/glicko2";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface RateResult {
  contestId: string;
  rated: number;
  skipped: boolean;
}

/**
 * Rate a contest. Reads the eligible ranked field from the leaderboard snapshot,
 * loads each player's current ORBIT (or seeds a new one), applies the Glicko-2
 * update, and writes orbit_ratings + orbit_history in one transaction.
 */
export async function rateContest(contestId: string): Promise<RateResult> {
  await ensureContestSchema();
  const p = pool();

  // Already rated? (idempotent — any history row for this contest means done)
  const done = await p.query(`SELECT 1 FROM contest.orbit_history WHERE contest_id = $1 LIMIT 1`, [contestId]);
  if (done.rowCount && done.rowCount > 0) {
    return { contestId, rated: 0, skipped: true };
  }

  // The ranked field (eligible only — the snapshot already excludes flagged/
  // unfinished). percentile is 0..100.
  const field = await p.query<{ user_id: string; percentile: string }>(
    `SELECT user_id, percentile FROM contest.leaderboard_snapshot WHERE contest_id = $1`,
    [contestId],
  );
  if (field.rows.length === 0) return { contestId, rated: 0, skipped: true };

  const userIds = field.rows.map((r) => r.user_id);

  // Current ratings for the field (seed the ones who have none).
  const existing = await p.query<{ user_id: string; current_rating: number; rd: number; volatility: number }>(
    `SELECT user_id, current_rating, rd, volatility FROM contest.orbit_ratings WHERE user_id = ANY($1::text[])`,
    [userIds],
  );
  const ratingByUser = new Map<string, Glicko2State>();
  for (const row of existing.rows) {
    ratingByUser.set(row.user_id, {
      rating: Number(row.current_rating),
      rd: Number(row.rd),
      volatility: Number(row.volatility),
    });
  }
  const stateFor = (u: string): Glicko2State => ratingByUser.get(u) ?? seedRating();

  // Field means (the virtual opponent), from the pre-contest ratings.
  const states = userIds.map(stateFor);
  const fieldMeanRating = states.reduce((a, s) => a + s.rating, 0) / states.length;
  const fieldMeanRd = states.reduce((a, s) => a + s.rd, 0) / states.length;
  const fieldSize = states.length;

  const client = await p.connect();
  try {
    await client.query("BEGIN");
    for (const row of field.rows) {
      const before = stateFor(row.user_id);
      const score = Math.min(1, Math.max(0, Number(row.percentile) / 100));
      const after = applyContest(before, { fieldMeanRating, fieldMeanRd, score, fieldSize });
      const change = after.rating - before.rating;

      await client.query(
        `INSERT INTO contest.orbit_ratings
           (user_id, current_rating, rd, volatility, games_played, previous_rating,
            highest_rating, lowest_rating, rating_change, last_updated)
         VALUES ($1, $2, $3, $4, 1, $5, $2, $2, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           previous_rating = contest.orbit_ratings.current_rating,
           current_rating  = EXCLUDED.current_rating,
           rd              = EXCLUDED.rd,
           volatility      = EXCLUDED.volatility,
           games_played    = contest.orbit_ratings.games_played + 1,
           highest_rating  = GREATEST(COALESCE(contest.orbit_ratings.highest_rating, EXCLUDED.current_rating), EXCLUDED.current_rating),
           lowest_rating   = LEAST(COALESCE(contest.orbit_ratings.lowest_rating, EXCLUDED.current_rating), EXCLUDED.current_rating),
           rating_change   = EXCLUDED.rating_change,
           last_updated    = NOW()`,
        [row.user_id, after.rating, after.rd, after.volatility, before.rating, change],
      );

      await client.query(
        `INSERT INTO contest.orbit_history
           (user_id, contest_id, rating_before, rating_after, rd_before, rd_after,
            volatility_before, volatility_after, rating_change, percentile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, contest_id) DO NOTHING`,
        [
          row.user_id,
          contestId,
          before.rating,
          after.rating,
          before.rd,
          after.rd,
          before.volatility,
          after.volatility,
          change,
          Number(row.percentile),
        ],
      );
    }
    await client.query("COMMIT");
    return { contestId, rated: field.rows.length, skipped: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface OrbitSummary {
  rating: number;
  rd: number;
  gamesPlayed: number;
  provisional: boolean;
  tier: string;
  ratingChange: number | null;
  highestRating: number | null;
}

/** A user's current ORBIT summary (for the profile / result screen). */
export async function getOrbitSummary(userId: string): Promise<OrbitSummary | null> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT current_rating, rd, games_played, rating_change, highest_rating
       FROM contest.orbit_ratings WHERE user_id = $1`,
    [userId],
  );
  if (!res.rows[0]) return null;
  const { isProvisional, orbitTier } = await import("@/lib/contest/glicko2");
  const rating = Number(res.rows[0].current_rating);
  const rd = Number(res.rows[0].rd);
  return {
    rating: Math.round(rating),
    rd: Math.round(rd),
    gamesPlayed: res.rows[0].games_played,
    provisional: isProvisional(rd),
    tier: orbitTier(rating),
    ratingChange: res.rows[0].rating_change != null ? Math.round(Number(res.rows[0].rating_change)) : null,
    highestRating: res.rows[0].highest_rating != null ? Math.round(Number(res.rows[0].highest_rating)) : null,
  };
}
