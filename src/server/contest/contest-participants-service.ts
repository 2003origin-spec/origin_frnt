/**
 * Admin participants view for one contest.
 *
 * A single joined read (registrations ⟕ attempts ⟕ leaderboard ⟕ users ⟕ orbit
 * ⟕ teams) with server-side pagination — a popular contest can have thousands
 * of rows, so we never render the whole set. Reads from the REPLICA pool (like
 * the leaderboard) to keep this admin-only reporting off the primary.
 *
 * PRIVACY: rows carry student PII (name/email/mobile) and most Origin students
 * are minors. Callers must be admin-gated, mobile is masked unless explicitly
 * revealed, and every list/export is audit-logged by the route.
 */

import { getUserPostgresReplicaPool, getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function readPool() {
  return getUserPostgresReplicaPool() ?? getUserPostgresPool();
}

export type AttemptState = "not_started" | "in_progress" | "submitted" | "auto_submitted";

export interface ParticipantRow {
  userId: string;
  name: string | null;
  email: string | null;
  /** Masked (e.g. +91•••••38658) unless the caller asked to reveal. */
  mobile: string | null;
  isPremium: boolean;
  /** Registration */
  registeredAt: string | null;
  registrationStatus: "registered" | "waitlisted";
  teamName: string | null;
  accessCode: string | null;
  /** Attempt */
  attemptState: AttemptState;
  startedAt: string | null;
  finishedAt: string | null;
  autoSubmitted: boolean;
  finalizeReason: string | null;
  timeTakenSeconds: number | null;
  /** Scoring — null until they submit */
  score: number | null;
  correct: number | null;
  incorrect: number | null;
  unattempted: number | null;
  accuracyPct: number | null;
  sectionScores: Record<string, unknown> | null;
  /** Ranking — null until results are published */
  rank: number | null;
  percentile: number | null;
  /** Integrity */
  violationCount: number;
  reviewStatus: "none" | "flagged" | "cleared" | "upheld";
  eligible: boolean;
  proctorSnapshotCount: number;
  /** ORBIT */
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
}

export interface ParticipantsSummary {
  registered: number;
  waitlisted: number;
  started: number;
  submitted: number;
  autoSubmitted: number;
  noShows: number;
  dropOffs: number;
  flagged: number;
  ineligible: number;
  avgScore: number | null;
  medianScore: number | null;
  topScore: number | null;
  avgTimeSeconds: number | null;
}

export interface ParticipantsFilter {
  search?: string | null;
  attemptState?: AttemptState | "all" | null;
  registrationStatus?: "registered" | "waitlisted" | "all" | null;
  flaggedOnly?: boolean;
  ineligibleOnly?: boolean;
  premiumOnly?: boolean;
  autoSubmittedOnly?: boolean;
  sort?: string | null;
  limit?: number;
  offset?: number;
  /** Reveal full mobile numbers (audit-logged by the caller). */
  revealMobile?: boolean;
}

/** +919366738658 → +91•••••38658 (keep country code + last 5). */
function maskMobile(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.length <= 5) return "•••••";
  const tail = digits.slice(-5);
  const head = digits.startsWith("+") ? digits.slice(0, 3) : "";
  return `${head}•••••${tail}`;
}

const SORTS: Record<string, string> = {
  rank: "l.rank ASC NULLS LAST",
  score: "a.score DESC NULLS LAST",
  name: "u.name ASC NULLS LAST",
  registered: "r.registered_at DESC NULLS LAST",
  time: "a.time_taken_seconds ASC NULLS LAST",
  violations: "a.violation_count DESC",
};

/** Human-facing attempt state from the raw attempt row. */
function attemptStateOf(row: { started_at: unknown; finished_at: unknown; auto_submitted: unknown }): AttemptState {
  if (!row.started_at) return "not_started";
  if (!row.finished_at) return "in_progress";
  return row.auto_submitted ? "auto_submitted" : "submitted";
}

/**
 * One page of participants. `total` is the count matching the filter (for
 * pagination), independent of limit/offset.
 */
export async function listContestParticipants(
  contestId: string,
  filter: ParticipantsFilter = {},
): Promise<{ rows: ParticipantRow[]; total: number }> {
  await ensureContestSchema();
  const pool = readPool();
  if (!pool) return { rows: [], total: 0 };

  const limit = Math.max(1, Math.min(200, filter.limit ?? 50));
  const offset = Math.max(0, filter.offset ?? 0);

  const where: string[] = ["r.contest_id = $1"];
  const vals: unknown[] = [contestId];
  let i = 2;

  const search = (filter.search ?? "").trim();
  if (search) {
    vals.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.name) LIKE $${i} OR LOWER(u.email) LIKE $${i} OR LOWER(u.id) LIKE $${i})`);
    i += 1;
  }
  if (filter.registrationStatus && filter.registrationStatus !== "all") {
    vals.push(filter.registrationStatus);
    where.push(`r.status = $${i}`);
    i += 1;
  }
  if (filter.attemptState && filter.attemptState !== "all") {
    if (filter.attemptState === "not_started") where.push(`a.started_at IS NULL`);
    else if (filter.attemptState === "in_progress") where.push(`(a.started_at IS NOT NULL AND a.finished_at IS NULL)`);
    else if (filter.attemptState === "submitted") where.push(`(a.finished_at IS NOT NULL AND a.auto_submitted = false)`);
    else if (filter.attemptState === "auto_submitted") where.push(`(a.finished_at IS NOT NULL AND a.auto_submitted = true)`);
  }
  if (filter.flaggedOnly) where.push(`a.review_status = 'flagged'`);
  if (filter.ineligibleOnly) where.push(`a.eligibility = false`);
  if (filter.premiumOnly) where.push(`u.is_premium = true`);
  if (filter.autoSubmittedOnly) where.push(`a.auto_submitted = true`);

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderSql = SORTS[filter.sort ?? "rank"] ?? SORTS.rank;

  // Base joins are shared by the count and the page so the total always matches.
  const FROM = `
    FROM contest.registrations r
    JOIN origin_users u ON u.id = r.user_id
    LEFT JOIN contest.attempts a ON a.contest_id = r.contest_id AND a.user_id = r.user_id
    LEFT JOIN contest.leaderboard_snapshot l ON l.contest_id = r.contest_id AND l.user_id = r.user_id
    LEFT JOIN contest.orbit_history o ON o.contest_id = r.contest_id AND o.user_id = r.user_id
    LEFT JOIN contest.team_members tm ON tm.contest_id = r.contest_id AND tm.user_id = r.user_id
    LEFT JOIN contest.teams t ON t.id = tm.team_id
    LEFT JOIN contest.access_codes ac ON ac.contest_id = r.contest_id AND ac.redeemed_by = r.user_id
  `;

  const countRes = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n ${FROM} ${whereSql}`, vals);

  const pageRes = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, u.mobile, u.is_premium,
            r.registered_at, r.status AS reg_status,
            t.name AS team_name, ac.code AS access_code,
            a.started_at, a.finished_at, a.auto_submitted, a.finalize_reason,
            a.time_taken_seconds, a.score, a.correct_count, a.incorrect_count,
            a.unattempted_count, a.section_scores, a.violation_count,
            a.review_status, a.eligibility,
            l.rank, l.percentile,
            o.rating_before, o.rating_after, o.rating_change,
            (SELECT COUNT(*)::int FROM contest.proctor_snapshots ps
              WHERE ps.contest_id = r.contest_id AND ps.user_id = r.user_id) AS snapshots
       ${FROM} ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${limit} OFFSET ${offset}`,
    vals,
  );

  const rows: ParticipantRow[] = pageRes.rows.map((row) => {
    const correct = row.correct_count as number | null;
    const incorrect = row.incorrect_count as number | null;
    const attempted = (correct ?? 0) + (incorrect ?? 0);
    return {
      userId: row.user_id,
      name: row.name ?? null,
      email: row.email ?? null,
      mobile: filter.revealMobile ? (row.mobile ?? null) : maskMobile(row.mobile ?? null),
      isPremium: Boolean(row.is_premium),
      registeredAt: row.registered_at ? new Date(row.registered_at).toISOString() : null,
      registrationStatus: (row.reg_status as "registered" | "waitlisted") ?? "registered",
      teamName: row.team_name ?? null,
      accessCode: row.access_code ?? null,
      attemptState: attemptStateOf(row),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
      autoSubmitted: Boolean(row.auto_submitted),
      finalizeReason: row.finalize_reason ?? null,
      timeTakenSeconds: row.time_taken_seconds ?? null,
      score: row.score == null ? null : Number(row.score),
      correct,
      incorrect,
      unattempted: row.unattempted_count ?? null,
      accuracyPct: attempted > 0 ? Math.round(((correct ?? 0) / attempted) * 100) : null,
      sectionScores: (row.section_scores as Record<string, unknown> | null) ?? null,
      rank: row.rank ?? null,
      percentile: row.percentile == null ? null : Number(row.percentile),
      violationCount: row.violation_count ?? 0,
      reviewStatus: (row.review_status as ParticipantRow["reviewStatus"]) ?? "none",
      eligible: row.eligibility !== false,
      proctorSnapshotCount: row.snapshots ?? 0,
      ratingBefore: row.rating_before == null ? null : Number(row.rating_before),
      ratingAfter: row.rating_after == null ? null : Number(row.rating_after),
      ratingChange: row.rating_change == null ? null : Number(row.rating_change),
    };
  });

  return { rows, total: countRes.rows[0]?.n ?? 0 };
}

/** Funnel + score/integrity aggregates for the header (whole contest, unfiltered). */
export async function getParticipantsSummary(contestId: string): Promise<ParticipantsSummary> {
  await ensureContestSchema();
  const pool = readPool();
  if (!pool) {
    return { registered: 0, waitlisted: 0, started: 0, submitted: 0, autoSubmitted: 0, noShows: 0, dropOffs: 0, flagged: 0, ineligible: 0, avgScore: null, medianScore: null, topScore: null, avgTimeSeconds: null };
  }
  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.status = 'registered')::int AS registered,
       COUNT(*) FILTER (WHERE r.status = 'waitlisted')::int AS waitlisted,
       COUNT(*) FILTER (WHERE a.started_at IS NOT NULL)::int AS started,
       COUNT(*) FILTER (WHERE a.finished_at IS NOT NULL)::int AS submitted,
       COUNT(*) FILTER (WHERE a.auto_submitted)::int AS auto_submitted,
       COUNT(*) FILTER (WHERE a.review_status = 'flagged')::int AS flagged,
       COUNT(*) FILTER (WHERE a.eligibility = false)::int AS ineligible,
       AVG(a.score) FILTER (WHERE a.finished_at IS NOT NULL) AS avg_score,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.score)
         FILTER (WHERE a.finished_at IS NOT NULL) AS median_score,
       MAX(a.score) AS top_score,
       AVG(a.time_taken_seconds) FILTER (WHERE a.finished_at IS NOT NULL) AS avg_time
     FROM contest.registrations r
     LEFT JOIN contest.attempts a ON a.contest_id = r.contest_id AND a.user_id = r.user_id
     WHERE r.contest_id = $1`,
    [contestId],
  );
  const r = res.rows[0] ?? {};
  const registered = r.registered ?? 0;
  const started = r.started ?? 0;
  const submitted = r.submitted ?? 0;
  const num = (v: unknown) => (v == null ? null : Number(Number(v).toFixed(2)));
  return {
    registered,
    waitlisted: r.waitlisted ?? 0,
    started,
    submitted,
    autoSubmitted: r.auto_submitted ?? 0,
    noShows: Math.max(0, registered - started),
    dropOffs: Math.max(0, started - submitted),
    flagged: r.flagged ?? 0,
    ineligible: r.ineligible ?? 0,
    avgScore: num(r.avg_score),
    medianScore: num(r.median_score),
    topScore: num(r.top_score),
    avgTimeSeconds: r.avg_time == null ? null : Math.round(Number(r.avg_time)),
  };
}

export interface ParticipantAnswer {
  position: number;
  questionId: string;
  subject: string | null;
  chapter: string | null;
  text: string;
  options: string[] | null;
  correctOption: number | null;
  submittedOption: number | null;
  submittedText: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  timeSpentSeconds: number | null;
}

/** One participant's question-by-question responses (support/dispute drill-down). */
export async function getParticipantAnswers(contestId: string, userId: string): Promise<ParticipantAnswer[]> {
  await ensureContestSchema();
  const pool = readPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT position, question_id, question_snapshot, submitted_answer, is_correct, marks_awarded, time_spent_seconds
       FROM contest.submission_answers
      WHERE contest_id = $1 AND user_id = $2
      ORDER BY position ASC`,
    [contestId, userId],
  );
  return res.rows.map((row) => {
    const s = (row.question_snapshot ?? {}) as Record<string, unknown>;
    const sub = (row.submitted_answer ?? {}) as Record<string, unknown>;
    return {
      position: row.position,
      questionId: row.question_id,
      subject: (s.subject as string) ?? null,
      chapter: (s.chapter as string) ?? null,
      text: String(s.text ?? ""),
      options: Array.isArray(s.options) ? (s.options as string[]) : null,
      correctOption: typeof s.correctOption === "number" ? s.correctOption : null,
      submittedOption: typeof sub.selectedOption === "number" ? sub.selectedOption : null,
      submittedText: typeof sub.answerText === "string" ? sub.answerText : null,
      isCorrect: row.is_correct,
      marksAwarded: row.marks_awarded == null ? null : Number(row.marks_awarded),
      timeSpentSeconds: row.time_spent_seconds ?? null,
    };
  });
}

/** Proctoring snapshot keys for one participant (newest first). */
export async function getParticipantSnapshots(contestId: string, userId: string): Promise<{ r2Key: string; capturedAt: string }[]> {
  await ensureContestSchema();
  const pool = readPool();
  if (!pool) return [];
  const res = await pool.query<{ r2_key: string; captured_at: string }>(
    `SELECT r2_key, captured_at FROM contest.proctor_snapshots
      WHERE contest_id = $1 AND user_id = $2 ORDER BY captured_at DESC LIMIT 200`,
    [contestId, userId],
  );
  return res.rows.map((r) => ({ r2Key: r.r2_key, capturedAt: new Date(r.captured_at).toISOString() }));
}
