/**
 * Contest attempt runtime (plan Phase 3). Starting + state for the rated
 * attempt. The timer is SERVER-AUTHORITATIVE: the only deadline is the contest's
 * fixed end_at, so a late entrant simply gets a shorter clock (D5a) and no
 * client value can extend it. Autosave (Phase-1 Redis buffer) and submit
 * (Phase 4) are separate. All checks are fail-CLOSED and use DB NOW().
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { claimActiveSession } from "./contest-session-registry";
import { ensureContestSchema } from "./contest-schema";
import { readContestDraft } from "./contest-draft-store";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function attemptError(status: number, message: string, code?: string): Error & { status: number; code?: string } {
  const err = new Error(message) as Error & { status: number; code?: string };
  err.status = status;
  if (code) err.code = code;
  return err;
}

export interface AttemptState {
  contestId: string;
  userId: string;
  started: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Fixed contest deadline — the ONLY authoritative end. */
  endAt: string | null;
  durationSeconds: number | null;
  /** Server clock, so the client can correct a skewed device clock. */
  serverNow: string;
  /** Seconds remaining until end_at (server-computed, never negative). */
  remainingSeconds: number;
  /** True once the attempt is locked (submitted/finalized). */
  locked: boolean;
  /** The durable draft (answers/palette) so a reload mid-attempt rehydrates the
   *  UI instead of showing a blank paper. Null when there's no draft yet. */
  savedAnswers: Record<string, { selectedOption?: number }> | null;
  savedPalette: Record<string, unknown> | null;
  /** The draft's monotonic rev, so the resumed client continues the rev sequence
   *  (never sends a lower rev that the buffer would reject, or a partial set that
   *  a higher rev would overwrite the durable draft with). */
  savedRev: number;
}

interface ContestRow {
  status: string;
  start_at: Date | null;
  end_at: Date | null;
  duration_seconds: number | null;
  server_now: Date;
}

async function loadContestForRun(contestId: string): Promise<ContestRow> {
  const res = await pool().query(
    `SELECT status, start_at, end_at, duration_seconds, NOW() AS server_now
       FROM contest.contests WHERE id = $1`,
    [contestId],
  );
  const row = res.rows[0];
  if (!row) throw attemptError(404, "Contest not found.");
  return row as ContestRow;
}

function remaining(endAt: Date | null, now: Date): number {
  if (!endAt) return 0;
  return Math.max(0, Math.floor((endAt.getTime() - now.getTime()) / 1000));
}

/**
 * Start (or resume) the rated attempt. Fail-closed: requires an active
 * registration AND the contest LIVE (start_at ≤ NOW < end_at), all in SQL vs DB
 * NOW(). Single attempt per (contest,user) via the PK; a second call after
 * start just resumes (idempotent). Denormalizes registered_at onto the attempt
 * for the ranking index. Rejects once finished (locked).
 */
export async function startAttempt(
  contestId: string,
  userId: string,
  sid?: string,
): Promise<AttemptState> {
  await ensureContestSchema();
  const p = pool();

  // Guarded insert: lands only when registered AND the contest is live now.
  // registered_at is copied from the registration row for the ranking index.
  const inserted = await p.query(
    `INSERT INTO contest.attempts (contest_id, user_id, registered_at, started_at)
     SELECT c.id, $2, r.registered_at, NOW()
       FROM contest.contests c
       JOIN contest.registrations r ON r.contest_id = c.id AND r.user_id = $2
      WHERE c.id = $1
        AND c.status = 'scheduled'
        AND c.start_at IS NOT NULL AND c.end_at IS NOT NULL
        AND NOW() >= c.start_at AND NOW() < c.end_at
     ON CONFLICT (contest_id, user_id) DO NOTHING
     RETURNING started_at`,
    [contestId, userId],
  );

  if (!inserted.rows[0]) {
    // Either already started (resume) or not startable — disambiguate.
    const existing = await p.query(
      `SELECT started_at, finished_at FROM contest.attempts WHERE contest_id = $1 AND user_id = $2`,
      [contestId, userId],
    );
    if (!existing.rows[0]) {
      // Not started and insert didn't fire → not registered or not live.
      const reg = await p.query(
        `SELECT 1 FROM contest.registrations WHERE contest_id = $1 AND user_id = $2`,
        [contestId, userId],
      );
      if (reg.rowCount === 0) throw attemptError(403, "Register for the contest first.", "not_registered");
      throw attemptError(409, "The contest is not currently live.", "not_live");
    }
    // else: fall through to state (resume).
  }

  // This session becomes the sole active writer (evicts an older tab/device).
  if (sid) await claimActiveSession(contestId, userId, sid);

  return getAttemptState(contestId, userId);
}

/**
 * Current attempt state for the client countdown (skew-corrected client-side
 * from serverNow) and the resume decision. Does not mutate.
 */
export async function getAttemptState(contestId: string, userId: string): Promise<AttemptState> {
  await ensureContestSchema();
  const contest = await loadContestForRun(contestId);
  const attempt = await pool().query(
    `SELECT started_at, finished_at FROM contest.attempts WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  const a = attempt.rows[0] ?? null;
  const now = contest.server_now;

  // Rehydrate the durable draft for a resuming client (only while the attempt is
  // live and unfinished — a finished attempt has no editable draft).
  let savedAnswers: Record<string, { selectedOption?: number }> | null = null;
  let savedPalette: Record<string, unknown> | null = null;
  let savedRev = 0;
  if (a?.started_at && !a?.finished_at) {
    const draft = await readContestDraft(contestId, userId);
    if (draft) {
      savedAnswers = (draft.answers ?? {}) as Record<string, { selectedOption?: number }>;
      savedPalette = (draft.palette ?? {}) as Record<string, unknown>;
      savedRev = typeof draft.rev === "number" ? draft.rev : 0;
    }
  }

  return {
    contestId,
    userId,
    started: Boolean(a?.started_at),
    startedAt: a?.started_at ? new Date(a.started_at).toISOString() : null,
    finishedAt: a?.finished_at ? new Date(a.finished_at).toISOString() : null,
    endAt: contest.end_at ? new Date(contest.end_at).toISOString() : null,
    durationSeconds: contest.duration_seconds,
    serverNow: new Date(now).toISOString(),
    remainingSeconds: remaining(contest.end_at, now),
    locked: Boolean(a?.finished_at),
    savedAnswers,
    savedPalette,
    savedRev,
  };
}
