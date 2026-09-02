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

// ─── Per-question analytics (Phase 4A) ───────────────────────────────────────

export interface QuestionAnalyticsRow {
  position: number;
  questionId: string;
  subject: string | null;
  chapter: string | null;
  questionType: string | null;
  text: string;
  /** Attempts that ANSWERED this question (submitted_answer not null). */
  attempted: number;
  /** Of those attempted, how many were correct. */
  correct: number;
  /** correct / attempted, 0..1; null when nobody attempted. */
  percentCorrect: number | null;
  /** Mean seconds spent (over rows that recorded a time). */
  avgTimeSeconds: number | null;
  /** Discrimination: point-biserial-style top-third vs bottom-third correct gap. */
  discrimination: number | null;
  /** MCQ option pick distribution by index (from submitted_answer.selectedOption). */
  optionCounts: number[];
}

/**
 * Per-question analytics for one contest, from the immutable per-question graded
 * snapshots in contest.submission_answers. Computes attempt/correct counts,
 * %-correct, mean time, MCQ option distribution, and a top/bottom-third
 * discrimination index. Admin-only, on-demand (cold path).
 */
export async function getContestQuestionAnalytics(contestId: string): Promise<QuestionAnalyticsRow[]> {
  await ensureContestSchema();
  const res = await pool().query<{
    position: number;
    question_id: string;
    question_snapshot: Record<string, unknown>;
    submitted_answer: Record<string, unknown> | null;
    is_correct: boolean | null;
    time_spent_seconds: number | null;
    user_id: string;
  }>(
    `SELECT position, question_id, question_snapshot, submitted_answer, is_correct, time_spent_seconds, user_id
       FROM contest.submission_answers WHERE contest_id = $1`,
    [contestId],
  );
  if (res.rows.length === 0) return [];

  // Per-user total correct → the top/bottom third split for discrimination.
  const perUserCorrect = new Map<string, number>();
  for (const r of res.rows) {
    if (r.is_correct) perUserCorrect.set(r.user_id, (perUserCorrect.get(r.user_id) ?? 0) + 1);
    else if (!perUserCorrect.has(r.user_id)) perUserCorrect.set(r.user_id, 0);
  }
  const rankedUsers = [...perUserCorrect.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
  const third = Math.max(1, Math.floor(rankedUsers.length / 3));
  const topSet = new Set(rankedUsers.slice(0, third));
  const bottomSet = new Set(rankedUsers.slice(-third));

  const byPos = new Map<number, typeof res.rows>();
  for (const r of res.rows) {
    const arr = byPos.get(r.position) ?? [];
    arr.push(r);
    byPos.set(r.position, arr);
  }

  const out: QuestionAnalyticsRow[] = [];
  for (const [position, rows] of [...byPos.entries()].sort((a, b) => a[0] - b[0])) {
    const snap = rows[0].question_snapshot ?? {};
    const options = Array.isArray(snap.options) ? (snap.options as unknown[]) : [];
    const optionCounts = new Array(options.length).fill(0);
    let attempted = 0;
    let correct = 0;
    let timeSum = 0;
    let timeN = 0;
    let topCorrect = 0;
    let bottomCorrect = 0;
    for (const r of rows) {
      const answered = r.submitted_answer != null && Object.keys(r.submitted_answer).length > 0;
      if (answered) attempted += 1;
      if (r.is_correct) correct += 1;
      if (typeof r.time_spent_seconds === "number") { timeSum += r.time_spent_seconds; timeN += 1; }
      const sel = r.submitted_answer?.selectedOption;
      if (typeof sel === "number" && sel >= 0 && sel < optionCounts.length) optionCounts[sel] += 1;
      if (topSet.has(r.user_id) && r.is_correct) topCorrect += 1;
      if (bottomSet.has(r.user_id) && r.is_correct) bottomCorrect += 1;
    }
    const discrimination = topSet.size && bottomSet.size
      ? Number((topCorrect / topSet.size - bottomCorrect / bottomSet.size).toFixed(3))
      : null;
    out.push({
      position,
      questionId: rows[0].question_id,
      subject: (snap.subject as string) ?? null,
      chapter: (snap.chapter as string) ?? null,
      questionType: (snap.questionType as string) ?? null,
      text: String(snap.text ?? "").slice(0, 200),
      attempted,
      correct,
      percentCorrect: attempted ? Number((correct / attempted).toFixed(3)) : null,
      avgTimeSeconds: timeN ? Number((timeSum / timeN).toFixed(1)) : null,
      discrimination,
      optionCounts,
    });
  }
  return out;
}
