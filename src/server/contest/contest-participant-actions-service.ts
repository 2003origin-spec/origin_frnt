/**
 * Admin actions on a contest participant (Phase: participants view).
 *
 * Deliberately narrow: promote from the waitlist, unregister, and set
 * eligibility (disqualify / reinstate). Cheating clear/uphold already lives in
 * contest-review-service and is reused by the UI rather than duplicated here.
 *
 * Every mutation is audited by the route. Where results are already published,
 * changing eligibility recomputes the leaderboard so ranks stay truthful.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";
import { getContestAccessConfig, promoteFromWaitlist } from "./contest-access-service";
import { recomputeContest } from "./contest-review-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function actionError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

async function isPublished(contestId: string): Promise<boolean> {
  const res = await pool().query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  return res.rows[0]?.status === "result_published";
}

/** Promote one waitlisted registration to a confirmed seat (ignores the cap —
 *  an explicit admin override), or run the FIFO auto-promotion when no user is
 *  given. Returns how many seats were filled. */
export async function promoteParticipant(contestId: string, userId?: string | null): Promise<{ promoted: number }> {
  await ensureContestSchema();
  if (userId) {
    const res = await pool().query(
      `UPDATE contest.registrations SET status = 'registered'
        WHERE contest_id = $1 AND user_id = $2 AND status = 'waitlisted'`,
      [contestId, userId],
    );
    if ((res.rowCount ?? 0) === 0) throw actionError(409, "That participant is not on the waitlist.");
    return { promoted: 1 };
  }
  const access = await getContestAccessConfig(contestId);
  const promoted = await promoteFromWaitlist(contestId, access?.registrationCap ?? null);
  return { promoted };
}

/**
 * Remove a registration. Refuses once the participant has started, so we never
 * orphan a graded attempt. Frees a seat, so the waitlist auto-promotes after.
 */
export async function unregisterParticipant(contestId: string, userId: string): Promise<{ promoted: number }> {
  await ensureContestSchema();
  const attempt = await pool().query(
    `SELECT started_at FROM contest.attempts WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  if (attempt.rows[0]?.started_at) {
    throw actionError(409, "This participant has already started the contest — disqualify them instead of unregistering.");
  }
  const res = await pool().query(
    `DELETE FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  if ((res.rowCount ?? 0) === 0) throw actionError(404, "Registration not found.");
  const access = await getContestAccessConfig(contestId);
  const promoted = await promoteFromWaitlist(contestId, access?.registrationCap ?? null).catch(() => 0);
  return { promoted };
}

/**
 * Disqualify (eligible=false) or reinstate (eligible=true) an attempt. When the
 * contest's results are already published, the leaderboard is recomputed so the
 * change is reflected in ranks/percentiles immediately.
 */
export async function setParticipantEligibility(
  contestId: string,
  userId: string,
  eligible: boolean,
): Promise<void> {
  await ensureContestSchema();
  const res = await pool().query(
    `UPDATE contest.attempts
        SET eligibility = $3,
            review_status = CASE WHEN $3 THEN 'cleared' ELSE 'upheld' END,
            updated_at = NOW()
      WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId, eligible],
  );
  if ((res.rowCount ?? 0) === 0) throw actionError(404, "No attempt found for that participant.");
  if (await isPublished(contestId)) await recomputeContest(contestId).catch(() => undefined);
}
