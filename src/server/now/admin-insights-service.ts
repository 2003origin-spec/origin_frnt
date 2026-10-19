/**
 * Read-only views for the Origin NOW admin console (build step 10; plan doc
 * "Admin", "Cherry-picking check", "Metrics"): the live monitor, session
 * review, per-solver metrics with the concentration report, and people search.
 *
 * Live queries, not a roll-up: at pilot size (hundreds of students, a dozen
 * solvers) they stay fast on the existing indexes (plan decision B52).
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { isLowAcceptRate, istDayKey } from "./matching";
import { listOnlineHelpers } from "./now-realtime";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings, isWithinOpenHours } from "./now-settings";
import { evaluateScorecard, repeatUse, type Scorecard } from "./pilot-scorecard-rules";
import { NOW_SUBJECTS } from "./solver-rules";
import { DIFFICULTIES } from "./types";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export function istDayStart(now: Date): Date {
  return new Date(`${istDayKey(now.getTime())}T00:00:00+05:30`);
}

export function istMonthStart(now: Date): Date {
  return new Date(`${istDayKey(now.getTime()).slice(0, 7)}-01T00:00:00+05:30`);
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// ---------------------------------------------------------------------------
// Live monitor.

export async function getLiveMonitor(now: Date = new Date()) {
  const pool = await db();
  const dayStart = istDayStart(now);
  const [waiting, live, today, queues, events] = await Promise.all([
    pool.query<{ id: string; subject: string; difficulty: string; status: string; failed_offers: number; created_at: Date }>(
      `SELECT id, subject, difficulty, status, failed_offers, created_at FROM now.requests
        WHERE status IN ('requested', 'offered') ORDER BY created_at LIMIT 100`,
    ),
    pool.query<{ id: string; request_id: string; subject: string; solver_kind: string; helper_name: string; started_at: Date | null; ends_at: Date | null; accepted_at: Date }>(
      `SELECT s.id, s.request_id, r.subject, s.solver_kind, h.display_name AS helper_name, s.started_at, s.ends_at, s.accepted_at
         FROM now.sessions s JOIN now.requests r ON r.id = s.request_id JOIN now.helpers h ON h.id = s.helper_id
        WHERE s.ended_at IS NULL ORDER BY s.accepted_at LIMIT 100`,
    ),
    pool.query<{
      requests: number;
      human_sessions: number;
      bot_sessions: number;
      human_within_10: number;
      no_helper: number;
      cancelled: number;
      median_wait_ms: number | null;
    }>(
      `SELECT
         (SELECT count(*)::int FROM now.requests WHERE created_at >= $1) AS requests,
         (SELECT count(*)::int FROM now.sessions WHERE solver_kind = 'human' AND started_at >= $1) AS human_sessions,
         (SELECT count(*)::int FROM now.sessions WHERE solver_kind = 'bot' AND started_at >= $1) AS bot_sessions,
         (SELECT count(*)::int FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
           WHERE s.solver_kind = 'human' AND s.started_at >= $1 AND s.started_at - r.created_at <= interval '10 minutes') AS human_within_10,
         (SELECT count(*)::int FROM now.requests WHERE created_at >= $1 AND status = 'no_helper') AS no_helper,
         (SELECT count(*)::int FROM now.requests WHERE created_at >= $1 AND status = 'cancelled') AS cancelled,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (s.started_at - r.created_at)) * 1000)
            FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
           WHERE s.solver_kind = 'human' AND s.started_at >= $1) AS median_wait_ms`,
      [dayStart],
    ),
    pool.query<{ open_reports: number; child_safety: number; restricted: number; applications: number }>(
      `SELECT
         (SELECT count(*)::int FROM now.reports WHERE status = 'open') AS open_reports,
         (SELECT count(*)::int FROM now.reports WHERE status = 'open' AND reason = 'child_safety') AS child_safety,
         (SELECT count(*)::int FROM now.helpers WHERE verification_status = 'restricted') AS restricted,
         (SELECT count(*)::int FROM now.helper_applications WHERE status = 'submitted') AS applications`,
    ),
    pool.query<{ type: string; at: Date; request_id: string | null; session_id: string | null }>(
      `SELECT type, at, request_id, session_id FROM now.events ORDER BY id DESC LIMIT 30`,
    ),
  ]);

  const online: Record<string, { count: number; helpers: { id: string; name: string }[] }> = {};
  const ids = new Set<string>();
  const bySubject = new Map<string, string[]>();
  for (const subject of NOW_SUBJECTS) {
    const map = await listOnlineHelpers(subject, now.getTime()).catch(() => new Map<string, number>());
    bySubject.set(subject, [...map.keys()]);
    for (const id of map.keys()) ids.add(id);
  }
  const names = ids.size
    ? (await pool.query<{ id: string; display_name: string }>(`SELECT id, display_name FROM now.helpers WHERE id = ANY($1::text[])`, [[...ids]])).rows
    : [];
  const nameOf = new Map(names.map((n) => [n.id, n.display_name]));
  for (const [subject, list] of bySubject) {
    online[subject] = { count: list.length, helpers: list.map((id) => ({ id, name: nameOf.get(id) ?? id })) };
  }

  const t = today.rows[0];
  return {
    at: now.toISOString(),
    waiting: waiting.rows.map((r) => ({
      requestId: r.id,
      subject: r.subject,
      difficulty: r.difficulty,
      status: r.status,
      failedOffers: r.failed_offers,
      waitedSeconds: Math.round((now.getTime() - r.created_at.getTime()) / 1000),
    })),
    live: live.rows.map((r) => ({
      sessionId: r.id,
      requestId: r.request_id,
      subject: r.subject,
      solverKind: r.solver_kind,
      solverName: r.helper_name,
      startedAt: iso(r.started_at),
      endsAt: iso(r.ends_at),
      joining: r.started_at === null,
    })),
    online,
    today: {
      requests: t.requests,
      humanSessions: t.human_sessions,
      botSessions: t.bot_sessions,
      // Human connect rate never counts the bot (plan doc "Metrics").
      humanConnectWithin10: t.requests ? t.human_within_10 / t.requests : null,
      botShare: t.human_sessions + t.bot_sessions ? t.bot_sessions / (t.human_sessions + t.bot_sessions) : null,
      noHelper: t.no_helper,
      cancelled: t.cancelled,
      medianHumanWaitSeconds: t.median_wait_ms === null ? null : Math.round(Number(t.median_wait_ms) / 1000),
    },
    queues: queues.rows[0],
    recentEvents: events.rows.map((e) => ({ type: e.type, at: e.at.toISOString(), requestId: e.request_id, sessionId: e.session_id })),
  };
}

// ---------------------------------------------------------------------------
// Sessions.

export async function listSessionsForAdmin(filter: { status?: string | null; solverKind?: string | null; limit?: number } = {}) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filter.status) {
    values.push(filter.status);
    where.push(`r.status = $${values.length}`);
  }
  if (filter.solverKind) {
    values.push(filter.solverKind);
    where.push(`s.solver_kind = $${values.length}`);
  }
  values.push(Math.min(Math.max(filter.limit ?? 100, 1), 500));
  const res = await (await db()).query(
    `SELECT s.id, s.request_id, r.status, r.subject, r.chapter, r.difficulty, s.solver_kind, h.display_name AS solver_name,
            u.name AS student_name, u.email AS student_email, s.accepted_at, s.started_at, s.ended_at, s.ended_by,
            s.outcome, s.payable, r.price_coins, (s.recording_key IS NOT NULL) AS has_recording,
            (SELECT stars FROM now.ratings rt WHERE rt.session_id = s.id LIMIT 1) AS stars,
            (SELECT count(*)::int FROM now.reports rp WHERE rp.session_id = s.id) AS reports
       FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
       JOIN now.helpers h ON h.id = s.helper_id JOIN origin_users u ON u.id = s.student_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.accepted_at DESC LIMIT $${values.length}`,
    values,
  );
  return res.rows.map((r) => ({
    sessionId: r.id,
    requestId: r.request_id,
    status: r.status,
    subject: r.subject,
    chapter: r.chapter,
    difficulty: r.difficulty,
    solverKind: r.solver_kind,
    solverName: r.solver_name,
    studentName: r.student_name,
    studentEmail: r.student_email,
    acceptedAt: iso(r.accepted_at),
    startedAt: iso(r.started_at),
    endedAt: iso(r.ended_at),
    endedBy: r.ended_by,
    durationSeconds: r.started_at && r.ended_at ? Math.round((r.ended_at.getTime() - r.started_at.getTime()) / 1000) : null,
    outcome: r.outcome,
    payable: r.payable,
    priceCoins: r.price_coins,
    hasRecording: r.has_recording,
    stars: r.stars,
    reports: r.reports,
  }));
}

/** Everything about one session for the review page (admins see full names). */
export async function getSessionReview(sessionId: string) {
  const pool = await db();
  const s = await pool.query(
    `SELECT s.*, r.status AS request_status, r.subject, r.chapter, r.concept, r.difficulty, r.question_id, r.context_json,
            r.price_coins, r.created_at AS requested_at, r.closed_reason, r.closed_detail, r.language,
            h.display_name AS solver_name, h.user_id AS solver_user_id, u.name AS student_name, u.email AS student_email
       FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
       JOIN now.helpers h ON h.id = s.helper_id JOIN origin_users u ON u.id = s.student_id
      WHERE s.id = $1`,
    [sessionId],
  );
  const row = s.rows[0];
  if (!row) return null;
  const [offers, events, ratings, reports, ledger] = await Promise.all([
    pool.query(
      `SELECT o.id, o.rank, o.offered_at, o.expires_at, o.response, o.decline_reason, o.responded_at, h.display_name
         FROM now.offers o JOIN now.helpers h ON h.id = o.helper_id WHERE o.request_id = $1 ORDER BY o.offered_at`,
      [row.request_id],
    ),
    pool.query(
      `SELECT type, actor, at, payload FROM now.events WHERE request_id = $1 OR session_id = $2 ORDER BY id`,
      [row.request_id, sessionId],
    ),
    pool.query(`SELECT stars, tags, comment, counted, held_until_case_closes, tip_coins, created_at FROM now.ratings WHERE session_id = $1`, [sessionId]),
    pool.query(`SELECT id, reason, reporter_role, status, details, created_at FROM now.reports WHERE session_id = $1 ORDER BY created_at`, [sessionId]),
    pool.query(
      `SELECT t.kind, t.amount, t.idempotency_key, t.created_at FROM now.ledger_transfers t WHERE t.request_id = $1 ORDER BY t.created_at`,
      [row.request_id],
    ),
  ]);
  const question = (row.context_json?.question ?? {}) as { text?: string; options?: string[] };
  return {
    sessionId,
    requestId: row.request_id,
    requestStatus: row.request_status,
    subject: row.subject,
    chapter: row.chapter,
    concept: row.concept,
    difficulty: row.difficulty,
    language: row.language,
    questionId: row.question_id,
    question: { text: question.text ?? "", options: question.options ?? [] },
    priceCoins: row.price_coins,
    solverKind: row.solver_kind,
    solverName: row.solver_name,
    solverUserId: row.solver_user_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    requestedAt: iso(row.requested_at),
    acceptedAt: iso(row.accepted_at),
    startedAt: iso(row.started_at),
    endsAt: iso(row.ends_at),
    endedAt: iso(row.ended_at),
    endedBy: row.ended_by,
    extensionsUsed: row.extensions_used,
    outcome: row.outcome,
    rootCause: row.root_cause,
    payable: row.payable,
    settledAt: iso(row.settled_at),
    closedReason: row.closed_reason,
    closedDetail: row.closed_detail,
    hasRecording: Boolean(row.recording_key),
    recordingDeletedAt: iso(row.recording_deleted_at),
    offers: offers.rows,
    events: events.rows,
    ratings: ratings.rows,
    reports: reports.rows,
    ledger: ledger.rows,
  };
}

// ---------------------------------------------------------------------------
// Metrics: cherry-picking check, fallback by difficulty, concentration report.

export const CONCENTRATION_LIMIT = 0.4;

/** Pure: share of a solver's coins this month from their top three students. */
export function topThreeShare(coinsByStudent: readonly number[]): number {
  const total = coinsByStudent.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const top = [...coinsByStudent].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return top / total;
}

export async function getNowMetrics(now: Date = new Date()) {
  const pool = await db();
  const monthStart = istMonthStart(now);
  const [helpers, offers, sessions, captures, fallback] = await Promise.all([
    pool.query<{ id: string; user_id: string; display_name: string; verification_status: string }>(
      `SELECT id, user_id, display_name, verification_status FROM now.helpers WHERE kind = 'human' ORDER BY display_name`,
    ),
    pool.query<{ helper_id: string; difficulty: string; offers: number; accepted: number; too_hard: number; declined: number }>(
      `SELECT o.helper_id, r.difficulty, count(*)::int AS offers,
              count(*) FILTER (WHERE o.response = 'accepted')::int AS accepted,
              count(*) FILTER (WHERE o.response = 'declined')::int AS declined,
              count(*) FILTER (WHERE o.decline_reason = 'too_hard')::int AS too_hard
         FROM now.offers o JOIN now.requests r ON r.id = o.request_id
        WHERE o.response IS NOT NULL GROUP BY o.helper_id, r.difficulty`,
    ),
    pool.query<{ helper_id: string; sessions: number; resolved: number; with_outcome: number; avg_stars: number | null }>(
      `SELECT s.helper_id, count(*)::int AS sessions,
              count(*) FILTER (WHERE s.outcome = 'resolved')::int AS resolved,
              count(*) FILTER (WHERE s.outcome IS NOT NULL)::int AS with_outcome,
              (SELECT avg(stars)::float FROM now.ratings rt WHERE rt.helper_id = s.helper_id AND rt.counted AND NOT rt.held_until_case_closes) AS avg_stars
         FROM now.sessions s WHERE s.started_at IS NOT NULL GROUP BY s.helper_id`,
    ),
    pool.query<{ solver_user_id: string; student_id: string; coins: number }>(
      `SELECT substring(e.account_id FROM 6) AS solver_user_id, r.student_id, sum(e.amount)::int AS coins
         FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
         JOIN now.requests r ON r.id = t.request_id
        WHERE e.direction = 'credit' AND e.account_id LIKE 'user:%' AND t.kind IN ('session_capture', 'tip')
          AND e.created_at >= $1 AND e.account_id <> 'user:' || r.student_id
        GROUP BY 1, 2`,
      [monthStart],
    ),
    pool.query<{ difficulty: string; sessions: number; bot: number }>(
      `SELECT r.difficulty, count(*)::int AS sessions, count(*) FILTER (WHERE s.solver_kind = 'bot')::int AS bot
         FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
        WHERE s.started_at IS NOT NULL GROUP BY r.difficulty`,
    ),
  ]);

  const coinsBySolver = new Map<string, number[]>();
  for (const c of captures.rows) {
    const list = coinsBySolver.get(c.solver_user_id) ?? [];
    list.push(c.coins);
    coinsBySolver.set(c.solver_user_id, list);
  }
  const sessionsBy = new Map(sessions.rows.map((s) => [s.helper_id, s]));
  const solvers = helpers.rows.map((h) => {
    const rows = offers.rows.filter((o) => o.helper_id === h.id);
    const total = rows.reduce((a, r) => a + r.offers, 0);
    const accepted = rows.reduce((a, r) => a + r.accepted, 0);
    const declined = rows.reduce((a, r) => a + r.declined, 0);
    const tooHard = rows.reduce((a, r) => a + r.too_hard, 0);
    const s = sessionsBy.get(h.id);
    const coins = coinsBySolver.get(h.user_id) ?? [];
    const share = topThreeShare(coins);
    return {
      helperId: h.id,
      userId: h.user_id,
      name: h.display_name,
      status: h.verification_status,
      offers: total,
      acceptRate: total ? accepted / total : null,
      acceptRateByDifficulty: Object.fromEntries(
        DIFFICULTIES.map((d) => {
          const r = rows.find((x) => x.difficulty === d);
          return [d, r && r.offers ? r.accepted / r.offers : null];
        }),
      ),
      tooHardShareOfDeclines: declined ? tooHard / declined : null,
      lowAcceptRate: isLowAcceptRate(total, accepted),
      sessions: s?.sessions ?? 0,
      resolutionRate: s && s.with_outcome ? s.resolved / s.with_outcome : null,
      avgStars: s?.avg_stars === null || s?.avg_stars === undefined ? null : Number(s.avg_stars),
      monthCoins: coins.reduce((a, b) => a + b, 0),
      monthStudents: coins.length,
      topThreeShare: share,
      concentrationFlag: coins.length > 0 && share > CONCENTRATION_LIMIT && coins.reduce((a, b) => a + b, 0) > 0,
    };
  });

  const fallbackByDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => {
      const r = fallback.rows.find((x) => x.difficulty === d);
      return [d, { sessions: r?.sessions ?? 0, botShare: r && r.sessions ? r.bot / r.sessions : null }];
    }),
  );
  return { monthStart: monthStart.toISOString(), solvers, fallbackByDifficulty, concentrationLimit: CONCENTRATION_LIMIT };
}

// ---------------------------------------------------------------------------
// People search (wallet lookup, cohort, dashboards).

export async function searchPeople(query: string) {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await (await db()).query(
    `SELECT u.id, u.name, u.email, u.role, u.date_of_birth,
            EXISTS (SELECT 1 FROM now.pilot_cohort c WHERE c.user_id = u.id AND c.removed_at IS NULL) AS in_cohort,
            h.id AS helper_id, h.verification_status
       FROM origin_users u LEFT JOIN now.helpers h ON h.user_id = u.id
      WHERE u.id = $1 OR lower(u.email) LIKE $2 OR lower(u.name) LIKE $2
      ORDER BY (u.id = $1) DESC, u.email LIMIT 10`,
    [q, `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`],
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    hasDateOfBirth: Boolean(r.date_of_birth),
    inCohort: r.in_cohort,
    helperId: r.helper_id,
    helperStatus: r.verification_status,
  }));
}

// ---------------------------------------------------------------------------
// Pilot scorecard (pilot readiness item 1): the pass-or-fail table for a period.

export type ScorecardPeriod = { from: Date; to: Date };

/** Default period: from the first request ever (the pilot start) to now. */
export async function defaultScorecardPeriod(now: Date = new Date()): Promise<ScorecardPeriod> {
  const res = await (await db()).query<{ first: Date | null }>(`SELECT min(created_at) AS first FROM now.requests`);
  return { from: res.rows[0]?.first ?? istDayStart(now), to: now };
}

export async function getPilotScorecard(period: ScorecardPeriod): Promise<Scorecard & { from: string; to: string }> {
  const pool = await db();
  const { from, to } = period;
  const { openHours } = await getNowSettings();
  const [requests, offers, human, bot, online, ratings, reports] = await Promise.all([
    pool.query<{ student_id: string; created_at: Date; human_started: Date | null }>(
      `SELECT r.student_id, r.created_at,
              (SELECT min(s.started_at) FROM now.sessions s
                WHERE s.request_id = r.id AND s.solver_kind = 'human' AND s.started_at IS NOT NULL) AS human_started
         FROM now.requests r WHERE r.created_at >= $1 AND r.created_at < $2`,
      [from, to],
    ),
    pool.query<{ closed: number; accepted: number }>(
      `SELECT count(*)::int AS closed, count(*) FILTER (WHERE response = 'accepted')::int AS accepted
         FROM now.offers WHERE response IS NOT NULL AND offered_at >= $1 AND offered_at < $2`,
      [from, to],
    ),
    pool.query<{
      accepted: number;
      no_shows: number;
      call_minutes: number;
      resolved: number;
      partial: number;
      unresolved: number;
      live: number;
      evenings: number;
    }>(
      `SELECT count(*)::int AS accepted,
              count(*) FILTER (WHERE ended_by = 'no_show' AND helper_joined_at IS NULL)::int AS no_shows,
              COALESCE(sum(extract(epoch FROM (ended_at - started_at))) FILTER (WHERE started_at IS NOT NULL AND ended_at IS NOT NULL), 0)::float / 60 AS call_minutes,
              count(*) FILTER (WHERE outcome = 'resolved')::int AS resolved,
              count(*) FILTER (WHERE outcome = 'partial')::int AS partial,
              count(*) FILTER (WHERE outcome = 'unresolved')::int AS unresolved,
              count(*) FILTER (WHERE started_at IS NOT NULL)::int AS live,
              count(DISTINCT (started_at AT TIME ZONE 'Asia/Kolkata')::date) FILTER (WHERE started_at IS NOT NULL)::int AS evenings
         FROM now.sessions WHERE solver_kind = 'human' AND accepted_at >= $1 AND accepted_at < $2`,
      [from, to],
    ),
    pool.query<{ live: number; call_minutes: number; resolved: number }>(
      `SELECT count(*) FILTER (WHERE started_at IS NOT NULL)::int AS live,
              COALESCE(sum(extract(epoch FROM (ended_at - started_at))) FILTER (WHERE started_at IS NOT NULL AND ended_at IS NOT NULL), 0)::float / 60 AS call_minutes,
              count(*) FILTER (WHERE outcome = 'resolved')::int AS resolved
         FROM now.sessions WHERE solver_kind = 'bot' AND accepted_at >= $1 AND accepted_at < $2`,
      [from, to],
    ),
    pool.query<{ minutes: number }>(
      `SELECT count(*)::int AS minutes FROM now.presence_minutes p JOIN now.helpers h ON h.id = p.helper_id
        WHERE h.kind = 'human' AND p.minute >= $1 AND p.minute < $2`,
      [from, to],
    ),
    pool.query<{ ratings: number; stars: number; not_solved: number }>(
      `SELECT count(*)::int AS ratings, COALESCE(sum(rt.stars), 0)::int AS stars,
              count(*) FILTER (WHERE 'not_resolved' = ANY(rt.tags))::int AS not_solved
         FROM now.ratings rt JOIN now.helpers h ON h.id = rt.helper_id
        WHERE h.kind = 'human' AND rt.counted AND NOT rt.held_until_case_closes
          AND rt.created_at >= $1 AND rt.created_at < $2`,
      [from, to],
    ),
    pool.query<{ child_safety: number; abuse: number }>(
      `SELECT count(*) FILTER (WHERE reason = 'child_safety')::int AS child_safety,
              count(*) FILTER (WHERE reason = 'abuse')::int AS abuse
         FROM now.reports WHERE status = 'upheld' AND created_at >= $1 AND created_at < $2`,
      [from, to],
    ),
  ]);

  const inHours = requests.rows.filter((r) => isWithinOpenHours(openHours, r.created_at));
  const connectTimesMs = inHours
    .filter((r) => r.human_started)
    .map((r) => r.human_started!.getTime() - r.created_at.getTime());
  const repeat = repeatUse(
    requests.rows.map((r) => ({ studentId: r.student_id, createdAtMs: r.created_at.getTime() })),
    from.getTime(),
    to.getTime(),
  );
  const h = human.rows[0];
  const b = bot.rows[0];
  const card = evaluateScorecard({
    inHoursRequests: inHours.length,
    inHoursHumanWithin10: connectTimesMs.filter((ms) => ms <= 10 * 60_000).length,
    connectTimesMs,
    offersClosed: offers.rows[0].closed,
    offersAccepted: offers.rows[0].accepted,
    humanCallMinutes: Number(h.call_minutes),
    onlineMinutes: online.rows[0].minutes,
    humanAccepted: h.accepted,
    helperNoShows: h.no_shows,
    outcomes: { resolved: h.resolved, partial: h.partial, unresolved: h.unresolved },
    ratings: ratings.rows[0].ratings,
    starsTotal: ratings.rows[0].stars,
    notSolvedTags: ratings.rows[0].not_solved,
    firstHalfStudents: repeat.students,
    firstHalfReturned: repeat.returned,
    resolvedDoubts: h.resolved + b.resolved,
    botCallMinutes: Number(b.call_minutes),
    upheldChildSafety: reports.rows[0].child_safety,
    upheldAbuse: reports.rows[0].abuse,
    liveSessions: h.live + b.live,
    evenings: h.evenings,
  });
  return { ...card, from: from.toISOString(), to: to.toISOString() };
}
