/**
 * Contest success metrics — per-contest funnel + week-over-week retention cohorts
 * (plan §5.10, return-next-week / N-contests-later). Read model over the
 * contest.* tables (registrations / attempts). Admin-only, on-demand (not a hot
 * path) — a heavier aggregation is fine here.
 *
 * NOTE (deviation from the plan): the plan slated this for analytics-service, but
 * the contest participation data lives in THIS service's Neon (contest.* on the
 * USER pool), so aggregating here avoids a cross-service DB coupling. Can move to
 * analytics-service later if cohorts need to join non-contest data.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export interface ContestFunnelRow {
  contestId: string;
  name: string;
  startAt: string | null;
  registered: number;
  played: number;
  submitted: number;
  /** Players who ALSO played the immediately-next contest (by start_at). */
  returnedNext: number;
  /** returnedNext / played, 0..1; null for the latest contest (no "next" yet). */
  returnRate: number | null;
}

export interface ContestAnalytics {
  contests: ContestFunnelRow[];
  totals: { contests: number; avgReturnRate: number | null };
}

/**
 * Per-contest funnel (registered → played → submitted) plus the return-next-week
 * cohort. Ordered newest-first for display; retention is computed against the
 * chronologically-next contest.
 */
export async function getContestAnalytics(limit = 26): Promise<ContestAnalytics> {
  await ensureContestSchema();
  const res = await pool().query<{
    id: string;
    name: string;
    start_at: string | null;
    registered: string;
    played: string;
    submitted: string;
    returned_next: string;
  }>(
    `WITH ordered AS (
       SELECT id, name, start_at,
              ROW_NUMBER() OVER (ORDER BY start_at ASC NULLS LAST) AS rn
         FROM contest.contests
        WHERE status IN ('result_published', 'archived')
     ),
     players AS (
       SELECT DISTINCT contest_id, user_id
         FROM contest.attempts
        WHERE started_at IS NOT NULL
     )
     SELECT o.id, o.name, o.start_at,
       (SELECT COUNT(*) FROM contest.registrations r WHERE r.contest_id = o.id) AS registered,
       (SELECT COUNT(*) FROM players p WHERE p.contest_id = o.id) AS played,
       (SELECT COUNT(*) FROM contest.attempts a
          WHERE a.contest_id = o.id AND a.finished_at IS NOT NULL) AS submitted,
       COALESCE((
         SELECT COUNT(*) FROM players p1
           JOIN players p2 ON p2.user_id = p1.user_id
           JOIN ordered nxt ON nxt.rn = o.rn + 1 AND p2.contest_id = nxt.id
          WHERE p1.contest_id = o.id
       ), 0) AS returned_next
     FROM ordered o
     ORDER BY o.start_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  const rows: ContestFunnelRow[] = res.rows.map((r) => {
    const played = Number(r.played);
    const returnedNext = Number(r.returned_next);
    // The chronologically-latest contest has no "next" yet → return rate null.
    const isLatest = r === res.rows[0];
    return {
      contestId: r.id,
      name: r.name,
      startAt: r.start_at ? new Date(r.start_at).toISOString() : null,
      registered: Number(r.registered),
      played,
      submitted: Number(r.submitted),
      returnedNext,
      returnRate: isLatest || played === 0 ? null : returnedNext / played,
    };
  });

  const rated = rows.filter((r) => r.returnRate != null);
  const avgReturnRate = rated.length ? rated.reduce((s, r) => s + (r.returnRate ?? 0), 0) / rated.length : null;
  return { contests: rows, totals: { contests: rows.length, avgReturnRate } };
}
