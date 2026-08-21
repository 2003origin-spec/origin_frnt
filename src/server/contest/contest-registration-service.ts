/**
 * Contest registration — the authoritative student registration write
 * (plan Phase 1/2). The window check is done IN SQL against DB NOW() so it is
 * fail-CLOSED and uses one clock (never a per-lambda wall clock). Idempotent:
 * registering twice is a success, not a duplicate. Also feeds the approximate
 * registered-count (display-only, best-effort).
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { recordRegistration } from "./contest-counts";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function regError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface RegistrationResult {
  registered: true;
  registeredAt: string;
  alreadyRegistered: boolean;
}

/**
 * Register the user for a contest. Allowed only while the contest is scheduled
 * AND NOW() ∈ [reg_open, reg_close) AND not past end_at — all evaluated in SQL
 * against DB NOW(). Returns success (idempotent) or throws 409 when the window
 * is closed / the contest isn't registrable.
 */
export async function registerForContest(contestId: string, userId: string): Promise<RegistrationResult> {
  await ensureContestSchema();
  const p = pool();

  // Guarded insert: only lands when the contest is currently registrable.
  const inserted = await p.query(
    `INSERT INTO contest.registrations (contest_id, user_id)
     SELECT c.id, $2
       FROM contest.contests c
      WHERE c.id = $1
        AND c.status = 'scheduled'
        AND c.reg_open IS NOT NULL AND c.reg_close IS NOT NULL
        AND NOW() >= c.reg_open AND NOW() < c.reg_close
        AND (c.end_at IS NULL OR NOW() < c.end_at)
     ON CONFLICT (contest_id, user_id) DO NOTHING
     RETURNING registered_at`,
    [contestId, userId],
  );

  if (inserted.rows[0]) {
    // best-effort approximate counter (never blocks the real write)
    void recordRegistration(contestId, userId);
    return {
      registered: true,
      registeredAt: new Date(inserted.rows[0].registered_at).toISOString(),
      alreadyRegistered: false,
    };
  }

  // No insert: either already registered (idempotent success) or the window is
  // closed / contest not found. Disambiguate with an exact read.
  const existing = await p.query(
    `SELECT registered_at FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  if (existing.rows[0]) {
    return {
      registered: true,
      registeredAt: new Date(existing.rows[0].registered_at).toISOString(),
      alreadyRegistered: true,
    };
  }

  throw regError(409, "Registration is not open for this contest.");
}

/**
 * Authoritative "is this user registered for this contest" — an exact row read,
 * fail-closed (used at take-time / DPP-gate, NOT the approximate counter).
 */
export async function isRegisteredForContest(contestId: string, userId: string): Promise<boolean> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT 1 FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  return res.rowCount === 1;
}
