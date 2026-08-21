/**
 * Contest results pipeline (plan Phase 6). Drives a just-ended contest through
 * result_processing → result_published: once the contest is past its deadline
 * AND every started attempt is finalized, materialize the leaderboard and
 * publish. Idempotent — safe to run every cron tick.
 *
 * State: scheduled (ended by clock) → result_processing → result_published.
 * The pipeline only ADVANCES; a published contest is skipped.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { CONTEST_END_GRACE_SECONDS } from "@/lib/contest/contest-state";
import { rankContest } from "./contest-ranking-service";
import { rateContest } from "./contest-orbit-service";
import { awardContestRewards } from "./contest-reward-service";
import { applyContestGamification } from "./contest-gamification-service";
import { sendContestReminder } from "./contest-reminders-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface PublishResult {
  processed: string[];
  published: string[];
}

/**
 * Advance any contests that have ended and whose attempts are all finalized.
 * Returns which contests were ranked/published this tick.
 */
export async function processEndedContests(limit = 20): Promise<PublishResult> {
  await ensureContestSchema();
  const p = pool();

  // Candidates: 'scheduled' contests past end_at+grace whose started attempts
  // are ALL finished (no open attempt left for the finalize sweep to grade).
  const candidates = await p.query<{ id: string; name: string }>(
    `SELECT c.id, c.name
       FROM contest.contests c
      WHERE c.status = 'scheduled'
        AND c.end_at IS NOT NULL
        AND NOW() >= c.end_at + ($1 || ' seconds')::interval
        AND NOT EXISTS (
          SELECT 1 FROM contest.attempts a
           WHERE a.contest_id = c.id AND a.started_at IS NOT NULL AND a.finished_at IS NULL
        )
      LIMIT $2`,
    [String(CONTEST_END_GRACE_SECONDS), limit],
  );

  const processed: string[] = [];
  const published: string[] = [];
  for (const c of candidates.rows) {
    try {
      // Move to result_processing (marker for observers), rank, then publish.
      await p.query(`UPDATE contest.contests SET status = 'result_processing', updated_at = NOW() WHERE id = $1 AND status = 'scheduled'`, [c.id]);
      processed.push(c.id);
      await rankContest(c.id);
      // ORBIT rating batch over the ranked field (idempotent; before publish so
      // the published result can show rating movement).
      await rateContest(c.id);
      // Gamification (badges/streaks/personal-bests) + the separate OGCode
      // reward — both idempotent, both off the ranked/eligible field.
      await applyContestGamification(c.id);
      await awardContestRewards(c.id);
      await p.query(`UPDATE contest.contests SET status = 'result_published', updated_at = NOW() WHERE id = $1 AND status = 'result_processing'`, [c.id]);
      published.push(c.id);
      // "results published" reminder (best-effort, batched, idempotent).
      void sendContestReminder(c.id, c.name, "results").catch(() => undefined);
    } catch (error) {
      console.error("[contest results] publish failed", c.id, error);
    }
  }
  return { processed, published };
}
