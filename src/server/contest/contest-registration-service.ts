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
import {
  enforceContestEligibility,
  getContestAccessConfig,
  seatStatusForNewRegistration,
} from "./contest-access-service";
import {
  cacheRegistration,
  hasRegisteredSetCache,
  isCachedRegistration,
  uncacheRegistration,
} from "./contest-registered-set";

export { uncacheRegistration };

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
  /** Phase 5: true when the cap was full and the user landed on the waitlist. */
  waitlisted: boolean;
}

/**
 * Register the user for a contest. Allowed only while the contest is scheduled
 * AND NOW() ∈ [reg_open, reg_close) AND not past end_at — all evaluated in SQL
 * against DB NOW(). Returns success (idempotent) or throws 409 when the window
 * is closed / the contest isn't registrable.
 */
export async function registerForContest(
  contestId: string,
  userId: string,
  opts: { code?: string | null } = {},
): Promise<RegistrationResult> {
  await ensureContestSchema();
  const p = pool();

  // Access gate (Phase 5): enforce access_mode BEFORE inserting. Legacy contests
  // default to 'open'/uncapped, so this is a no-op for them. A code, if present,
  // is redeemed here; ineligibility throws 403.
  const access = await getContestAccessConfig(contestId);
  if (!access) throw regError(404, "Contest not found.");
  // Skip the gate for an already-registered user (idempotent re-register).
  const priorReg = await p.query(
    `SELECT status FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  if (!priorReg.rows[0]) {
    await enforceContestEligibility({ contestId, userId, accessMode: access.accessMode, code: opts.code });
  }
  const seatStatus = priorReg.rows[0]?.status
    ?? (await seatStatusForNewRegistration(contestId, access.registrationCap));

  // Guarded insert: only lands when the contest is currently registrable.
  const inserted = await p.query(
    `INSERT INTO contest.registrations (contest_id, user_id, status)
     SELECT c.id, $2, $3
       FROM contest.contests c
      WHERE c.id = $1
        AND c.status = 'scheduled'
        AND c.reg_open IS NOT NULL AND c.end_at IS NOT NULL
        -- Late registration (walk-up) allowed: open from reg_open until the
        -- contest ends, so a user can register during a LIVE contest and start.
        AND NOW() >= c.reg_open AND NOW() < c.end_at
     ON CONFLICT (contest_id, user_id) DO NOTHING
     RETURNING registered_at, status`,
    [contestId, userId, seatStatus],
  );

  if (inserted.rows[0]) {
    // best-effort approximate counter + registered-set cache (never block).
    void recordRegistration(contestId, userId);
    // Only a CONFIRMED seat enters the registered-set (the paper gate trusts a
    // hit); a waitlisted row is added on promotion instead.
    if (inserted.rows[0].status === "registered") void cacheRegistration(contestId, userId);
    return {
      registered: true,
      registeredAt: new Date(inserted.rows[0].registered_at).toISOString(),
      alreadyRegistered: false,
      waitlisted: inserted.rows[0].status === "waitlisted",
    };
  }

  // No insert: either already registered (idempotent success) or the window is
  // closed / contest not found. Disambiguate with an exact read.
  const existing = await p.query(
    `SELECT registered_at, status FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  if (existing.rows[0]) {
    return {
      registered: true,
      registeredAt: new Date(existing.rows[0].registered_at).toISOString(),
      alreadyRegistered: true,
      waitlisted: existing.rows[0].status === "waitlisted",
    };
  }

  throw regError(409, "Registration is not open for this contest.");
}

/**
 * Authoritative "is this user registered for this contest" — an exact row read,
 * fail-closed (used at take-time / paper gate / DPP-gate, NOT the approximate
 * counter). By default only a CONFIRMED seat (`status = 'registered'`) counts:
 * a waitlisted user must not read the paper or practise. Pass
 * `includeWaitlisted` for display surfaces (the status banner) that report
 * "registered/waitlisted" separately.
 */
export async function isRegisteredForContest(
  contestId: string,
  userId: string,
  opts: { includeWaitlisted?: boolean } = {},
): Promise<boolean> {
  const includeWaitlisted = Boolean(opts.includeWaitlisted);
  // Hot path (paper gate at the start_at burst): the Redis registered-set holds
  // CONFIRMED seats only and is SREMed on unregister, so a HIT is trustworthy.
  // A MISS falls through to Neon and self-heals the cache, so a non-registered
  // user is never wrongly admitted and Redis being down just degrades to the DB
  // path. (The waitlist-inclusive variant always reads Neon.)
  if (!includeWaitlisted && hasRegisteredSetCache()) {
    if ((await isCachedRegistration(contestId, userId)) === true) return true;
  }

  await ensureContestSchema();
  const res = await pool().query(
    `SELECT 1 FROM contest.registrations
      WHERE contest_id = $1 AND user_id = $2
        AND ($3::boolean OR status = 'registered')`,
    [contestId, userId, includeWaitlisted],
  );
  const registered = res.rowCount === 1;
  if (registered && !includeWaitlisted) void cacheRegistration(contestId, userId); // self-heal
  return registered;
}
