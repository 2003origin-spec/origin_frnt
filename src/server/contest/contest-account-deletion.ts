/**
 * Account-deletion hook for contest.* data.
 *
 * The platform deletes accounts by ANONYMIZE-IN-PLACE: the origin_users row is
 * kept (so leaderboards / aggregate stats keep referential integrity) and its
 * PII (name/email) is tombstoned. Contest tables store only `user_id`
 * references — NO direct PII (no names/emails) — so a deleted user's contest
 * history is already anonymized transitively via origin_users, and their
 * registrations / attempts / results / ORBIT rating / leaderboard rows are
 * intentionally RETAINED for competitive integrity (a past contest's ranking
 * must not shift because someone later deleted their account).
 *
 * The one thing that SHOULD be purged is transient live state: an in-progress
 * answer draft (a deleted account must not leave a draft that a finalize sweep
 * could later auto-submit) and its entry in the Redis registered-set cache for
 * any contest that has not finished. That is what this hook removes.
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { uncacheRegistration } from "./contest-registered-set";
import { ensureContestSchema } from "./contest-schema";

/**
 * Purge a user's transient live contest state on account deletion. Removes the
 * in-progress answer draft(s); retains all finalized/competitive rows (they
 * carry no PII and are needed for leaderboard/rating integrity). Safe no-op when
 * Postgres is unconfigured. Never throws into the deletion flow — a failure here
 * must not block the (PII-critical) account anonymization.
 */
export async function purgeLiveContestStateForUser(userId: string): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureContestSchema();
  const pool = getUserPostgresPool();
  if (!pool) return;
  // Live draft only. Registrations, attempts, submission_answers, orbit_ratings,
  // orbit_history, reward_ledger, leaderboard_snapshot, streaks, badges,
  // personal_bests are deliberately retained (no PII; competitive integrity).
  await pool.query(`DELETE FROM contest.answer_drafts WHERE user_id = $1`, [userId]);

  // The registration ROWS are retained, but a deleted account must lose its
  // paper-gate cache entry for any contest that has not finished yet.
  const open = await pool.query<{ contest_id: string }>(
    `SELECT r.contest_id
       FROM contest.registrations r
       JOIN contest.contests c ON c.id = r.contest_id
      WHERE r.user_id = $1 AND c.status = 'scheduled'
        AND (c.end_at IS NULL OR c.end_at > NOW())`,
    [userId],
  );
  for (const row of open.rows) await uncacheRegistration(row.contest_id, userId);
}
