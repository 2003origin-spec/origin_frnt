/**
 * Contest status for the register banner (plan Phase 2). Resolves the single
 * "current" contest to surface on the landing + dashboard entry points — the
 * nearest UPCOMING or currently-LIVE scheduled contest — plus the per-viewer
 * registration flag and the approximate registered count.
 *
 * All the heavy checks reuse Phase-1 primitives: state from resolveContestState
 * (time-derived), count from the HLL approx counter (display-only), and the
 * per-user flag from the authoritative registrations row.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { normalizeScoringConfig } from "@/lib/contest/contest-config";
import {
  type ContestState,
  type ContestWindow,
  resolveContestState,
} from "@/lib/contest/contest-state";
import { getUserPostgresReplicaPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { getApproxRegisteredCount } from "./contest-counts";
import { isRegisteredForContest } from "./contest-registration-service";
import { ensureContestSchema } from "./contest-schema";

export interface ContestSummary {
  id: string;
  name: string;
  state: ContestState;
  startAt: string | null;
  endAt: string | null;
  regOpen: string | null;
  regClose: string | null;
  bannerUrl: string | null;
  registeredCount: number;
  isRegistered: boolean;
  accessMode: 'open' | 'code' | 'premium';
}

export interface ContestStatus {
  enabled: boolean;
  contest: ContestSummary | null;
}

const DISABLED: ContestStatus = { enabled: false, contest: null };

/**
 * The banner's data. Returns `{enabled:false}` when the flag is off or nothing
 * is scheduled. Picks the most relevant scheduled contest: a currently-LIVE one
 * first, else the soonest UPCOMING one. `userId` is optional — the landing page
 * (logged-out) omits it and gets `isRegistered:false`.
 */
export async function getContestStatus(userId?: string | null): Promise<ContestStatus> {
  if (!isFeatureEnabled("contest")) return DISABLED;
  if (!isUserPostgresConfigured()) return DISABLED;
  await ensureContestSchema();

  const pool = getUserPostgresReplicaPool();
  if (!pool) return DISABLED;

  // Candidates: scheduled contests that are live now OR upcoming (not yet ended).
  // Ordered so the nearest-relevant one is first (live, then soonest upcoming).
  const res = await pool.query(
    `SELECT id, name, status, start_at, end_at, reg_open, reg_close, banner_url, access_mode
       FROM contest.contests
      WHERE status = 'scheduled'
        AND end_at IS NOT NULL AND NOW() < end_at
      ORDER BY (start_at <= NOW()) DESC, start_at ASC
      LIMIT 1`,
  );
  const row = res.rows[0];
  if (!row) return { enabled: true, contest: null };

  const window = {
    status: row.status as "scheduled",
    regOpen: row.reg_open ? new Date(row.reg_open) : null,
    regClose: row.reg_close ? new Date(row.reg_close) : null,
    startAt: row.start_at ? new Date(row.start_at) : null,
    endAt: row.end_at ? new Date(row.end_at) : null,
  };
  const state = resolveContestState(window, new Date());

  const [registeredCount, isRegistered] = await Promise.all([
    getApproxRegisteredCount(row.id).catch(() => 0),
    userId ? isRegisteredForContest(row.id, userId, { includeWaitlisted: true }).catch(() => false) : Promise.resolve(false),
  ]);

  return {
    enabled: true,
    contest: {
      id: row.id,
      name: row.name,
      state,
      startAt: window.startAt?.toISOString() ?? null,
      endAt: window.endAt?.toISOString() ?? null,
      regOpen: window.regOpen?.toISOString() ?? null,
      regClose: window.regClose?.toISOString() ?? null,
      bannerUrl: row.banner_url ?? null,
      registeredCount,
      isRegistered,
      accessMode: (row.access_mode as 'open' | 'code' | 'premium') ?? 'open',
    },
  };
}

/**
 * ALL currently-available contests (live now or upcoming, not yet ended), newest
 * window first. Powers the "see all contests" list — so multiple simultaneously
 * hosted contests are all visible, not just the single nearest one. `userId`
 * optional (logged-out → isRegistered:false).
 */
export async function getOpenContests(userId?: string | null): Promise<ContestSummary[]> {
  if (!isFeatureEnabled("contest")) return [];
  if (!isUserPostgresConfigured()) return [];
  await ensureContestSchema();

  const pool = getUserPostgresReplicaPool();
  if (!pool) return [];

  const res = await pool.query(
    `SELECT id, name, status, start_at, end_at, reg_open, reg_close, banner_url, access_mode
       FROM contest.contests
      WHERE status = 'scheduled'
        AND end_at IS NOT NULL AND NOW() < end_at
      ORDER BY (start_at <= NOW()) DESC, start_at ASC
      LIMIT 50`,
  );

  const now = new Date();
  return Promise.all(
    res.rows.map(async (row) => {
      const window = {
        status: row.status as "scheduled",
        regOpen: row.reg_open ? new Date(row.reg_open) : null,
        regClose: row.reg_close ? new Date(row.reg_close) : null,
        startAt: row.start_at ? new Date(row.start_at) : null,
        endAt: row.end_at ? new Date(row.end_at) : null,
      };
      const [registeredCount, isRegistered] = await Promise.all([
        getApproxRegisteredCount(row.id).catch(() => 0),
        userId ? isRegisteredForContest(row.id, userId, { includeWaitlisted: true }).catch(() => false) : Promise.resolve(false),
      ]);
      return {
        id: row.id,
        name: row.name,
        state: resolveContestState(window, now),
        startAt: window.startAt?.toISOString() ?? null,
        endAt: window.endAt?.toISOString() ?? null,
        regOpen: window.regOpen?.toISOString() ?? null,
        regClose: window.regClose?.toISOString() ?? null,
        bannerUrl: row.banner_url ?? null,
        registeredCount,
        isRegistered,
        accessMode: (row.access_mode as 'open' | 'code' | 'premium') ?? 'open',
      };
    }),
  );
}

/** One contest for the native app's lobby / result screens (no REST existed for "contest by id"). */
export interface ContestDetail extends ContestSummary {
  subjects: string[];
  durationSeconds: number | null;
  displayTz: string;
  /** Marks per correct / wrong / unattempted answer, for the rules card. */
  scoring: { correctMarks: number; incorrectMarks: number; unattemptedMarks: number };
  registrationCap: number | null;
  /** DB clock at read time, so the app can correct its countdown for device clock skew. */
  serverNow: string;
}

/**
 * A single public contest by id (anything but draft). `state` is derived from
 * the DB clock, like every server-side gate. Null when the flag is off, the
 * database isn't configured, or the contest doesn't exist / is a draft.
 */
export async function getContestDetail(contestId: string, userId?: string | null): Promise<ContestDetail | null> {
  if (!isFeatureEnabled("contest")) return null;
  if (!isUserPostgresConfigured()) return null;
  await ensureContestSchema();

  const pool = getUserPostgresReplicaPool();
  if (!pool) return null;

  const res = await pool.query(
    `SELECT id, name, status, start_at, end_at, reg_open, reg_close, banner_url, access_mode,
            subjects, duration_seconds, display_tz, scoring_config, registration_cap, NOW() AS db_now
       FROM contest.contests
      WHERE id = $1 AND status <> 'draft'`,
    [contestId],
  );
  const row = res.rows[0];
  if (!row) return null;

  const window = {
    status: row.status as ContestWindow["status"],
    regOpen: row.reg_open ? new Date(row.reg_open) : null,
    regClose: row.reg_close ? new Date(row.reg_close) : null,
    startAt: row.start_at ? new Date(row.start_at) : null,
    endAt: row.end_at ? new Date(row.end_at) : null,
  };
  const dbNow = new Date(row.db_now);
  const [registeredCount, isRegistered] = await Promise.all([
    getApproxRegisteredCount(row.id).catch(() => 0),
    userId ? isRegisteredForContest(row.id, userId).catch(() => false) : Promise.resolve(false),
  ]);
  const scoring = normalizeScoringConfig(row.scoring_config);

  return {
    id: row.id,
    name: row.name,
    state: resolveContestState(window, dbNow),
    startAt: window.startAt?.toISOString() ?? null,
    endAt: window.endAt?.toISOString() ?? null,
    regOpen: window.regOpen?.toISOString() ?? null,
    regClose: window.regClose?.toISOString() ?? null,
    bannerUrl: row.banner_url ?? null,
    registeredCount,
    isRegistered,
    accessMode: (row.access_mode as ContestSummary["accessMode"]) ?? "open",
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    durationSeconds: row.duration_seconds ?? null,
    displayTz: row.display_tz ?? "Asia/Kolkata",
    scoring: { correctMarks: scoring.correctMarks, incorrectMarks: scoring.incorrectMarks, unattemptedMarks: scoring.unattemptedMarks },
    registrationCap: row.registration_cap ?? null,
    serverNow: dbNow.toISOString(),
  };
}
