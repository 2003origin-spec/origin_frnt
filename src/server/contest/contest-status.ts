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
import {
  type ContestState,
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
    `SELECT id, name, status, start_at, end_at, reg_open, reg_close, banner_url
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
    userId ? isRegisteredForContest(row.id, userId).catch(() => false) : Promise.resolve(false),
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
    `SELECT id, name, status, start_at, end_at, reg_open, reg_close, banner_url
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
        userId ? isRegisteredForContest(row.id, userId).catch(() => false) : Promise.resolve(false),
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
      };
    }),
  );
}
