/**
 * Contest anti-cheat admin review (plan Phase 5). A 3-strike attempt is FLAGGED
 * (score computed, excluded from rank/ORBIT), not silently voided. An admin
 * lists flagged attempts and either CLEARS (re-include) or UPHOLDS (permanent
 * exclusion). Clearing after results are published triggers a recompute-from-
 * snapshot: because ranking + ORBIT are idempotent + replayable, we delete this
 * contest's orbit_history and re-run rank + rate, so the field's ratings become
 * exactly what they'd be had the (now-cleared) attempt always been eligible.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { rankContest } from "./contest-ranking-service";
import { rateContest } from "./contest-orbit-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface FlaggedAttempt {
  contestId: string;
  userId: string;
  violationCount: number;
  reviewStatus: string;
  score: number | null;
  finishedAt: string | null;
}

/** List flagged (pending-review) attempts for a contest. */
export async function listFlaggedAttempts(contestId: string): Promise<FlaggedAttempt[]> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT user_id, violation_count, review_status, score, finished_at
       FROM contest.attempts
      WHERE contest_id = $1 AND review_status = 'flagged'
      ORDER BY violation_count DESC, user_id ASC`,
    [contestId],
  );
  return res.rows.map((r) => ({
    contestId,
    userId: r.user_id,
    violationCount: r.violation_count,
    reviewStatus: r.review_status,
    score: r.score != null ? Number(r.score) : null,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
  }));
}

/**
 * Recompute a contest's results from the immutable snapshots — the replay path
 * used after a review changes eligibility once results were already published.
 * Deterministic + idempotent: clears this contest's orbit_history so rateContest
 * runs fresh, then re-ranks and re-rates the (updated) eligible field.
 */
async function recomputeContest(contestId: string): Promise<void> {
  await pool().query(`DELETE FROM contest.orbit_history WHERE contest_id = $1`, [contestId]);
  await rankContest(contestId);
  await rateContest(contestId);
}

async function contestIsPublished(contestId: string): Promise<boolean> {
  const res = await pool().query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  const status = res.rows[0]?.status;
  return status === "result_published" || status === "archived";
}

/**
 * Clear a flagged attempt (mark eligible again). If results are already
 * published, recompute so the leaderboard + ORBIT reflect the re-inclusion.
 */
export async function clearFlaggedAttempt(contestId: string, userId: string): Promise<void> {
  await ensureContestSchema();
  await pool().query(
    `UPDATE contest.attempts SET review_status = 'cleared', eligibility = true, updated_at = NOW()
      WHERE contest_id = $1 AND user_id = $2 AND review_status = 'flagged'`,
    [contestId, userId],
  );
  if (await contestIsPublished(contestId)) await recomputeContest(contestId);
}

/**
 * Uphold a flag (permanent exclusion). If results are published, recompute so
 * the leaderboard + ORBIT exclude the attempt (a no-op if it was already
 * excluded at publish, but safe + deterministic).
 */
export async function upholdFlaggedAttempt(contestId: string, userId: string): Promise<void> {
  await ensureContestSchema();
  await pool().query(
    `UPDATE contest.attempts SET review_status = 'upheld', eligibility = false, updated_at = NOW()
      WHERE contest_id = $1 AND user_id = $2 AND review_status = 'flagged'`,
    [contestId, userId],
  );
  if (await contestIsPublished(contestId)) await recomputeContest(contestId);
}
