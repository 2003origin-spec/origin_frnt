/**
 * Contest OGCode reward (plan Phase 8). Awards a contest's configured OGCode
 * points to each ELIGIBLE finisher, exactly once. This is the "kept separate"
 * point system: OGCode Points ⟂ Contest Points ⟂ ORBIT. The reward is recorded
 * in contest.reward_ledger (UNIQUE(contest_id,user_id)) — the idempotency lock —
 * and the ledger is NEVER read by the rating batch.
 *
 * Claim-then-credit: the ledger row is INSERTed first (ON CONFLICT DO NOTHING
 * RETURNING), so two concurrent ticks can't double-award; only the row that this
 * call inserted gets credited into app.user_scores via the proven OGCode delta
 * path. Flagged/upheld attempts are excluded until review clears them.
 */

import {
  PRACTICE_SUBMIT_PERSIST_COLLECTIONS,
  withStoreAsyncScoped,
} from "@/legacy/store";
import { applyOgcodeScoreDelta } from "@/server/gamification";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface RewardResult {
  contestId: string;
  awarded: number;
}

/**
 * Award the contest's OGCode reward to eligible finishers who haven't been paid
 * yet. Batched (LIMIT). Idempotent. Returns how many users were newly rewarded.
 */
export async function awardContestRewards(contestId: string, limit = 500): Promise<RewardResult> {
  await ensureContestSchema();
  const p = pool();

  const contest = await p.query(`SELECT ogcode_reward FROM contest.contests WHERE id = $1`, [contestId]);
  const reward = Number(contest.rows[0]?.ogcode_reward) || 0;
  if (reward <= 0) return { contestId, awarded: 0 };

  // Claim: eligible (finished + not flagged/upheld) finishers with no ledger row
  // yet. INSERT the claims and act only on the ones THIS call inserted.
  const claimed = await p.query<{ user_id: string }>(
    `WITH pending AS (
        SELECT a.user_id
          FROM contest.attempts a
          LEFT JOIN contest.reward_ledger l
            ON l.contest_id = a.contest_id AND l.user_id = a.user_id
         WHERE a.contest_id = $1
           AND a.finished_at IS NOT NULL
           AND a.review_status NOT IN ('flagged','upheld')
           AND l.user_id IS NULL
         LIMIT $2
      ), ins AS (
        INSERT INTO contest.reward_ledger (contest_id, user_id, ogcode_points)
        SELECT $1, user_id, $3 FROM pending
        ON CONFLICT (contest_id, user_id) DO NOTHING
        RETURNING user_id
      )
      SELECT user_id FROM ins`,
    [contestId, limit, reward],
  );
  if (claimed.rows.length === 0) return { contestId, awarded: 0 };

  // Credit the OGCode points into app.user_scores via the proven delta path.
  const description = `Contest reward: ${reward} OGCode points`;
  for (const row of claimed.rows) {
    await withStoreAsyncScoped(
      (store) => {
        applyOgcodeScoreDelta(store, row.user_id, reward, description, contestId);
      },
      { userId: row.user_id, collections: PRACTICE_SUBMIT_PERSIST_COLLECTIONS },
    );
  }

  return { contestId, awarded: claimed.rows.length };
}
