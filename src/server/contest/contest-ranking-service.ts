/**
 * Contest ranking + results (plan Phase 6). After a contest ends and all
 * attempts are finalized, materialize the leaderboard ONCE into
 * contest.leaderboard_snapshot — the single source of final rank. No live
 * ranking (D2).
 *
 * Total order (deterministic + reproducible across re-runs):
 *   score DESC, time_taken_seconds ASC, registered_at ASC, user_id ASC
 * — every column NOT NULL, so ties always break the same way. Percentile is
 * rank/total. ONLY eligible attempts are ranked (finished + not flagged/upheld);
 * no-shows and flagged attempts get no row (no spurious rank).
 */

import { getUserPostgresPool, getUserPostgresReplicaPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function writePool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface RankResult {
  contestId: string;
  ranked: number;
}

/**
 * Recompute the leaderboard snapshot for a contest from its eligible finished
 * attempts. Idempotent + replayable: it clears and rewrites the snapshot, so a
 * re-run (e.g. after a flag is cleared) produces the identical result. The whole
 * thing is one INSERT..SELECT with window functions, so 1M rows rank in the DB.
 */
export async function rankContest(contestId: string): Promise<RankResult> {
  await ensureContestSchema();
  const pool = writePool();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id = $1`, [contestId]);

    // Eligible = finished AND review_status not in (flagged, upheld). time_taken
    // and registered_at are coalesced to a deterministic max so a NULL never
    // makes the sort non-reproducible.
    const inserted = await client.query(
      `WITH eligible AS (
         SELECT
           a.user_id,
           a.score,
           COALESCE(a.time_taken_seconds, 2147483647) AS time_taken_seconds,
           COALESCE(a.registered_at, a.started_at, NOW()) AS registered_at
         FROM contest.attempts a
         WHERE a.contest_id = $1
           AND a.finished_at IS NOT NULL
           AND a.review_status NOT IN ('flagged','upheld')
       ), ranked AS (
         SELECT
           user_id, score, time_taken_seconds, registered_at,
           ROW_NUMBER() OVER (
             ORDER BY score DESC, time_taken_seconds ASC, registered_at ASC, user_id ASC
           ) AS rank,
           COUNT(*) OVER () AS total
         FROM eligible
       )
       INSERT INTO contest.leaderboard_snapshot
         (contest_id, rank, user_id, score, time_taken_seconds, registered_at, percentile)
       SELECT
         $1, rank, user_id, score, time_taken_seconds, registered_at,
         -- percentile: fraction of the field at or below this rank, 0..100.
         ROUND((100.0 * (total - rank + 1) / total)::numeric, 2)
       FROM ranked
       RETURNING 1`,
      [contestId],
    );

    await client.query("COMMIT");
    return { contestId, ranked: inserted.rowCount ?? 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  score: number;
  timeTakenSeconds: number | null;
  percentile: number;
}

/** Keyset-paged leaderboard page (rank > cursor). Reads via the replica. */
export async function getLeaderboardPage(
  contestId: string,
  cursor = 0,
  limit = 50,
): Promise<{ rows: LeaderboardRow[]; nextCursor: number | null }> {
  await ensureContestSchema();
  const pool = getUserPostgresReplicaPool();
  if (!pool) return { rows: [], nextCursor: null };
  const capped = Math.min(100, Math.max(1, limit));
  // Fetch one extra row to tell whether a further page exists, so the last full
  // page doesn't hand back a phantom cursor that resolves to an empty page.
  const res = await pool.query(
    `SELECT rank, user_id, score, time_taken_seconds, percentile
       FROM contest.leaderboard_snapshot
      WHERE contest_id = $1 AND rank > $2
      ORDER BY rank ASC
      LIMIT $3`,
    [contestId, cursor, capped + 1],
  );
  const hasMore = res.rows.length > capped;
  const pageRows = hasMore ? res.rows.slice(0, capped) : res.rows;
  const rows: LeaderboardRow[] = pageRows.map((r) => ({
    rank: r.rank,
    userId: r.user_id,
    score: Number(r.score),
    timeTakenSeconds: r.time_taken_seconds,
    percentile: Number(r.percentile),
  }));
  const nextCursor = hasMore ? rows[rows.length - 1].rank : null;
  return { rows, nextCursor };
}

export interface PersonalResult {
  rank: number;
  percentile: number;
  score: number;
  timeTakenSeconds: number | null;
  totalRanked: number;
}

/** A user's own rank/percentile from the snapshot, or null if unranked. */
export async function getPersonalResult(contestId: string, userId: string): Promise<PersonalResult | null> {
  await ensureContestSchema();
  const pool = getUserPostgresReplicaPool();
  if (!pool) return null;
  const [mine, total] = await Promise.all([
    pool.query(
      `SELECT rank, percentile, score, time_taken_seconds
         FROM contest.leaderboard_snapshot WHERE contest_id = $1 AND user_id = $2`,
      [contestId, userId],
    ),
    pool.query(`SELECT COUNT(*)::int AS n FROM contest.leaderboard_snapshot WHERE contest_id = $1`, [contestId]),
  ]);
  if (!mine.rows[0]) return null;
  return {
    rank: mine.rows[0].rank,
    percentile: Number(mine.rows[0].percentile),
    score: Number(mine.rows[0].score),
    timeTakenSeconds: mine.rows[0].time_taken_seconds,
    totalRanked: total.rows[0].n,
  };
}
