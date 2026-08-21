/**
 * Contest finalize sweep (plan Phase 4). The unattended backstop that
 * auto-submits every attempt still open past the contest deadline (end_at +
 * grace), so "went offline and never came back" becomes a graded attempt rather
 * than a blank. Reuses the idempotent submitAttempt (FOR-UPDATE + finished_at
 * claim), so it is safe to run concurrently with a student's manual submit and
 * to re-run after a crash.
 *
 * Batched (LIMIT) so a 1M-attempt contest drains across many ticks. The grading
 * itself lives in the TS submit service, so this runs in the frontend (invoked
 * by an internal cron) rather than the Python worker.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { CONTEST_END_GRACE_SECONDS } from "@/lib/contest/contest-state";
import { submitAttempt } from "./contest-submit-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface FinalizeSweepResult {
  finalized: number;
  scanned: number;
}

/**
 * Finalize up to `limit` attempts that are started, not yet finished, and whose
 * contest ended (NOW ≥ end_at + grace). Idempotent per attempt. Returns counts.
 */
export async function sweepExpiredAttempts(limit = 200): Promise<FinalizeSweepResult> {
  await ensureContestSchema();

  // Find candidates: an unfinished, started attempt whose contest is past its
  // deadline+grace. Uses the DB clock; grace is a single server constant.
  const candidates = await pool().query<{ contest_id: string; user_id: string }>(
    `SELECT a.contest_id, a.user_id
       FROM contest.attempts a
       JOIN contest.contests c ON c.id = a.contest_id
      WHERE a.started_at IS NOT NULL
        AND a.finished_at IS NULL
        AND c.end_at IS NOT NULL
        AND NOW() >= c.end_at + ($1 || ' seconds')::interval
      LIMIT $2`,
    [String(CONTEST_END_GRACE_SECONDS), limit],
  );

  let finalized = 0;
  for (const row of candidates.rows) {
    try {
      const res = await submitAttempt(row.contest_id, row.user_id, "deadline");
      if (!res.alreadySubmitted) finalized += 1;
    } catch (error) {
      // fail-open per attempt: a single grading error must not stop the sweep.
      console.error("[contest finalize] attempt failed", row.contest_id, row.user_id, error);
    }
  }
  return { finalized, scanned: candidates.rows.length };
}
