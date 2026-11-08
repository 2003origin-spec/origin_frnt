/**
 * Origin NOW dashboards (build step 10; plan doc "Dashboards"): the student's
 * doubts dashboard and the solver dashboard, built only from what the feature
 * already records (requests, sessions, offers, ratings, the coin ledger,
 * presence minutes). Admins open either one read-only.
 *
 * Privacy (plan doc): a solver sees students by first name only; a student
 * sees only their own history.
 */

import { ACCEPT_TIME_WINDOW_DAYS } from "@/lib/now-format";
import { getUserPostgresPool } from "@/server/user-postgres";

import { istDayStart, istMonthStart } from "./admin-insights-service";
import { userAccount } from "./ledger-rules";
import { getWalletBalance } from "./ledger-store";
import { DEFAULT_REVIEW_LIMITS, istDayKey } from "./matching";
import { NowError } from "./now-http";
import { listOnlineHelpers } from "./now-realtime";
import { ensureNowSchema } from "./now-schema";
import { firstNameOnly } from "./session-rules";
import { NOW_SUBJECTS } from "./solver-rules";
import { DIFFICULTIES } from "./types";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const seconds = (v: number | string | null) => (v === null ? null : Math.round(Number(v)));
const acceptWindowStart = (now: Date) => new Date(now.getTime() - ACCEPT_TIME_WINDOW_DAYS * 24 * 60 * 60_000);

async function onlineHelperIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const subject of NOW_SUBJECTS) {
    const online = await listOnlineHelpers(subject).catch(() => new Map<string, number>());
    for (const id of online.keys()) ids.add(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Student.

export async function getStudentDashboard(studentId: string, options: { page?: number } = {}, now: Date = new Date()) {
  const pool = await db();
  const page = Math.max(0, Math.floor(options.page ?? 0));
  const monthStart = istMonthStart(now);
  const [summary, spent, bySubject, weak, solvers, history, practice, balance] = await Promise.all([
    pool.query<{ asked: number; resolved: number; partial: number; unresolved: number; minutes: number | null }>(
      `SELECT (SELECT count(*)::int FROM now.requests WHERE student_id = $1) AS asked,
              count(*) FILTER (WHERE s.outcome = 'resolved')::int AS resolved,
              count(*) FILTER (WHERE s.outcome = 'partial')::int AS partial,
              count(*) FILTER (WHERE s.outcome = 'unresolved')::int AS unresolved,
              sum(extract(epoch FROM (s.ended_at - s.started_at)) / 60)::float AS minutes
         FROM now.sessions s WHERE s.student_id = $1 AND s.started_at IS NOT NULL`,
      [studentId],
    ),
    // Net coins spent on live help this month: holds + extensions + tips, minus what came back.
    pool.query<{ spent: number }>(
      `SELECT COALESCE(sum(CASE WHEN e.direction = 'debit' THEN e.amount ELSE -e.amount END), 0)::int AS spent
         FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
        WHERE e.account_id = $1 AND e.created_at >= $2
          AND t.kind IN ('session_hold', 'extension', 'tip', 'session_release')`,
      [userAccount(studentId), monthStart],
    ),
    pool.query<{ subject: string; chapter: string | null; doubts: number; resolved: number }>(
      `SELECT r.subject, r.chapter, count(*)::int AS doubts, count(*) FILTER (WHERE s.outcome = 'resolved')::int AS resolved
         FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
        WHERE s.student_id = $1 AND s.started_at IS NOT NULL
        GROUP BY r.subject, r.chapter ORDER BY doubts DESC LIMIT 30`,
      [studentId],
    ),
    pool.query<{ subject: string; chapter: string | null; concept: string | null; doubts: number; root_cause: string | null }>(
      `SELECT r.subject, r.chapter, r.concept, count(*)::int AS doubts,
              mode() WITHIN GROUP (ORDER BY s.root_cause) FILTER (WHERE s.root_cause IS NOT NULL) AS root_cause
         FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
        WHERE s.student_id = $1 AND s.started_at IS NOT NULL
        GROUP BY r.subject, r.chapter, r.concept ORDER BY doubts DESC LIMIT 5`,
      [studentId],
    ),
    pool.query<{
      helper_id: string;
      display_name: string;
      sessions: number;
      my_avg: number | null;
      favourite: boolean;
      subjects: string[];
      median_accept_s: number | null;
    }>(
      `WITH together AS (
         SELECT s.helper_id, count(*)::int AS sessions
           FROM now.sessions s WHERE s.student_id = $1 AND s.solver_kind = 'human' AND s.started_at IS NOT NULL
          GROUP BY s.helper_id
       ), favs AS (SELECT helper_id FROM now.favourites WHERE student_id = $1)
       SELECT h.id AS helper_id, h.display_name, COALESCE(t.sessions, 0) AS sessions,
              (SELECT avg(stars)::float FROM now.ratings rt WHERE rt.helper_id = h.id AND rt.rater_id = $1) AS my_avg,
              (h.id IN (SELECT helper_id FROM favs)) AS favourite,
              ARRAY(SELECT DISTINCT subject FROM now.helper_expertise e WHERE e.helper_id = h.id) AS subjects,
              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (o.responded_at - o.offered_at)))
                 FROM now.offers o WHERE o.helper_id = h.id AND o.response = 'accepted' AND o.offered_at >= $2)::float AS median_accept_s
         FROM now.helpers h LEFT JOIN together t ON t.helper_id = h.id
        WHERE (h.id IN (SELECT helper_id FROM together) OR h.id IN (SELECT helper_id FROM favs))
          AND h.verification_status = 'verified'
          AND NOT EXISTS (SELECT 1 FROM now.blocks b WHERE b.blocker_id = $1 AND b.blocked_id = h.user_id)`,
      [studentId, acceptWindowStart(now)],
    ),
    pool.query(
      `SELECT r.id, r.question_id, r.subject, r.chapter, r.difficulty, r.status, r.created_at, r.context_json->'question'->>'text' AS question_text,
              s.id AS session_id, s.solver_kind, h.display_name AS solver_name, s.started_at, s.ended_at, s.outcome,
              (SELECT stars FROM now.ratings rt WHERE rt.session_id = s.id AND rt.rater_id = r.student_id) AS stars,
              (SELECT COALESCE(sum(CASE WHEN e.direction = 'debit' THEN e.amount ELSE -e.amount END), 0)::int
                 FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
                WHERE t.request_id = r.id AND e.account_id = $2) AS coins
         FROM now.requests r
         LEFT JOIN LATERAL (SELECT * FROM now.sessions s WHERE s.request_id = r.id ORDER BY s.accepted_at DESC LIMIT 1) s ON TRUE
         LEFT JOIN now.helpers h ON h.id = s.helper_id
        WHERE r.student_id = $1 ORDER BY r.created_at DESC LIMIT 21 OFFSET $3`,
      [studentId, userAccount(studentId), page * 20],
    ),
    pool.query<{ session_id: string; offered: string[]; attempted: number; at: Date }>(
      `SELECT e.session_id, ARRAY(SELECT jsonb_array_elements_text(e.payload->'questionIds')) AS offered, e.at,
              (SELECT count(*)::int FROM now.events a WHERE a.session_id = e.session_id AND a.type = 'practice.attempted') AS attempted
         FROM now.events e WHERE e.actor = $1 AND e.type = 'practice.offered' ORDER BY e.id DESC LIMIT 10`,
      [studentId],
    ),
    getWalletBalance(studentId, now),
  ]);

  const online = await onlineHelperIds();
  const s = summary.rows[0];
  const mySolvers = solvers.rows
    .map((r) => ({
      helperId: r.helper_id,
      name: firstNameOnly(r.display_name),
      subjects: r.subjects,
      sessionsTogether: r.sessions,
      myAverageStars: r.my_avg === null ? null : Number(r.my_avg),
      medianAcceptSeconds: seconds(r.median_accept_s),
      favourite: r.favourite,
      online: online.has(r.helper_id),
    }))
    .sort(
      (a, b) =>
        Number(b.favourite) - Number(a.favourite) ||
        b.sessionsTogether - a.sessionsTogether ||
        (b.myAverageStars ?? 0) - (a.myAverageStars ?? 0) ||
        a.helperId.localeCompare(b.helperId),
    );

  return {
    summary: {
      asked: s.asked,
      resolved: s.resolved,
      partial: s.partial,
      unresolved: s.unresolved,
      minutes: Math.round(Number(s.minutes ?? 0)),
      coinsSpentThisMonth: Math.max(0, spent.rows[0].spent),
      balance: balance.available,
    },
    bySubject: bySubject.rows.map((r) => ({ subject: r.subject, chapter: r.chapter, doubts: r.doubts, resolvedShare: ratio(r.resolved, r.doubts) })),
    weakSpots: weak.rows.map((r) => ({ subject: r.subject, chapter: r.chapter, concept: r.concept, doubts: r.doubts, commonRootCause: r.root_cause })),
    mySolvers,
    history: history.rows.slice(0, 20).map((r) => ({
      requestId: r.id,
      questionId: r.question_id,
      question: String(r.question_text ?? "").slice(0, 160),
      subject: r.subject,
      chapter: r.chapter,
      difficulty: r.difficulty,
      status: r.status,
      createdAt: iso(r.created_at),
      sessionId: r.session_id,
      solverKind: r.solver_kind,
      solverName: r.solver_kind === "bot" ? "Origin" : r.solver_name ? firstNameOnly(r.solver_name) : null,
      minutes: r.started_at && r.ended_at ? Math.max(1, Math.round((r.ended_at.getTime() - r.started_at.getTime()) / 60_000)) : null,
      coinsSpent: Math.max(0, r.coins),
      outcome: r.outcome,
      stars: r.stars,
    })),
    hasMoreHistory: history.rows.length > 20,
    practice: practice.rows.map((r) => ({ sessionId: r.session_id, questionIds: r.offered, attempted: r.attempted, offeredAt: iso(r.at) })),
  };
}

/** A student can favourite a solver they have had a session with (no browsing of solvers). */
export async function setFavourite(studentId: string, helperId: string, favourite: boolean) {
  const pool = await db();
  if (favourite) {
    const together = await pool.query(
      `SELECT 1 FROM now.sessions WHERE student_id = $1 AND helper_id = $2 AND solver_kind = 'human' AND started_at IS NOT NULL LIMIT 1`,
      [studentId, helperId],
    );
    if ((together.rowCount ?? 0) === 0) throw new NowError(404, "not_found", "You can favourite a solver after a session with them.");
    await pool.query(`INSERT INTO now.favourites (student_id, helper_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [studentId, helperId]);
  } else {
    await pool.query(`DELETE FROM now.favourites WHERE student_id = $1 AND helper_id = $2`, [studentId, helperId]);
  }
  return { helperId, favourite };
}

// ---------------------------------------------------------------------------
// Solver.

export type ReviewWarning = { limit: string; detail: string };

/** Pure: warnings when a solver is ONE step from an automatic-review limit. */
export function reviewWarnings(input: {
  recentStars: readonly number[];
  notResolvedToday: number;
  reportsIn30Days: number;
}): ReviewWarning[] {
  const limits = DEFAULT_REVIEW_LIMITS;
  const warnings: ReviewWarning[] = [];
  const window = input.recentStars.slice(0, limits.window);
  if (window.length >= limits.minRatings - 1) {
    const avg = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
    if (avg < limits.minAverage + 0.3) {
      warnings.push({ limit: "rating", detail: `Your recent average is ${avg.toFixed(1)}; below ${limits.minAverage} pauses new offers.` });
    }
  }
  if (input.notResolvedToday === limits.notResolvedPerDay - 1) {
    warnings.push({ limit: "not_resolved", detail: `One more "doubt not solved" today pauses new offers until an admin reviews.` });
  }
  if (input.reportsIn30Days === limits.reportsPer30Days - 1) {
    warnings.push({ limit: "reports", detail: "One more report in 30 days pauses new offers until an admin reviews." });
  }
  return warnings;
}

export async function getSolverDashboard(solverUserId: string, now: Date = new Date()) {
  const pool = await db();
  const helperRes = await pool.query<{ id: string; display_name: string; verification_status: string; restricted_reason: string | null; is_minor: boolean }>(
    `SELECT id, display_name, verification_status, restricted_reason, is_minor FROM now.helpers WHERE user_id = $1`,
    [solverUserId],
  );
  const helper = helperRes.rows[0];
  if (!helper) throw new NowError(404, "not_a_solver", "This account is not an Origin NOW solver.");
  const dayStart = istDayStart(now);
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60_000);
  const monthStart = istMonthStart(now);
  const fourteen = new Date(dayStart.getTime() - 13 * 24 * 60 * 60_000);
  const account = userAccount(solverUserId);

  const [
    counts,
    offers,
    bySubject,
    byDifficulty,
    earningsDaily,
    earningsMonth,
    storeSpend,
    feedback,
    comments,
    recentStars,
    activity,
    sessionsDaily,
    expertise,
    reportsRecent,
    earningsWeekly,
    paidSessions,
    recentAccept,
  ] = await Promise.all([
      pool.query<{ today: number; week: number; month: number; all_time: number; resolved: number; with_outcome: number }>(
        `SELECT count(*) FILTER (WHERE started_at >= $2)::int AS today, count(*) FILTER (WHERE started_at >= $3)::int AS week,
                count(*) FILTER (WHERE started_at >= $4)::int AS month, count(*)::int AS all_time,
                count(*) FILTER (WHERE outcome = 'resolved')::int AS resolved, count(*) FILTER (WHERE outcome IS NOT NULL)::int AS with_outcome
           FROM now.sessions WHERE helper_id = $1 AND started_at IS NOT NULL`,
        [helper.id, dayStart, weekStart, monthStart],
      ),
      pool.query<{ offers: number; accepted: number; median_ms: number | null }>(
        `SELECT count(*)::int AS offers, count(*) FILTER (WHERE response = 'accepted')::int AS accepted,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (responded_at - offered_at)) * 1000)
                  FILTER (WHERE response = 'accepted') AS median_ms
           FROM now.offers WHERE helper_id = $1 AND response IS NOT NULL`,
        [helper.id],
      ),
      pool.query<{ subject: string; chapter: string | null; solved: number; resolved: number; with_outcome: number; avg_stars: number | null }>(
        `SELECT r.subject, r.chapter, count(*)::int AS solved,
                count(*) FILTER (WHERE s.outcome = 'resolved')::int AS resolved, count(*) FILTER (WHERE s.outcome IS NOT NULL)::int AS with_outcome,
                avg(rt.stars) FILTER (WHERE rt.counted AND NOT rt.held_until_case_closes)::float AS avg_stars
           FROM now.sessions s JOIN now.requests r ON r.id = s.request_id LEFT JOIN now.ratings rt ON rt.session_id = s.id
          WHERE s.helper_id = $1 AND s.started_at IS NOT NULL
          GROUP BY r.subject, r.chapter ORDER BY solved DESC LIMIT 30`,
        [helper.id],
      ),
      pool.query<{ difficulty: string; solved: number; offers: number; accepted: number }>(
        `SELECT r.difficulty,
                count(DISTINCT s.id) FILTER (WHERE s.started_at IS NOT NULL)::int AS solved,
                count(DISTINCT o.id) FILTER (WHERE o.response IS NOT NULL)::int AS offers,
                count(DISTINCT o.id) FILTER (WHERE o.response = 'accepted')::int AS accepted
           FROM now.requests r
           LEFT JOIN now.offers o ON o.request_id = r.id AND o.helper_id = $1
           LEFT JOIN now.sessions s ON s.request_id = r.id AND s.helper_id = $1
          WHERE o.id IS NOT NULL OR s.id IS NOT NULL
          GROUP BY r.difficulty`,
        [helper.id],
      ),
      pool.query<{ day: string; sessions: number; tips: number }>(
        `SELECT to_char(e.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'session_capture'), 0)::int AS sessions,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'tip'), 0)::int AS tips
           FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
          WHERE e.account_id = $1 AND e.direction = 'credit' AND t.kind IN ('session_capture', 'tip') AND e.created_at >= $2
          GROUP BY 1 ORDER BY 1`,
        [account, new Date(dayStart.getTime() - 29 * 24 * 60 * 60_000)],
      ),
      pool.query<{ sessions: number; tips: number }>(
        `SELECT COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'session_capture'), 0)::int AS sessions,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'tip'), 0)::int AS tips
           FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
          WHERE e.account_id = $1 AND e.direction = 'credit' AND e.created_at >= $2`,
        [account, monthStart],
      ),
      pool.query<{ spent: number }>(
        `SELECT COALESCE(sum(e.amount), 0)::int AS spent FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
          WHERE e.account_id = $1 AND e.direction = 'debit' AND t.kind = 'store_spend' AND e.created_at >= $2`,
        [account, monthStart],
      ),
      pool.query<{ tag: string; n: number }>(
        `SELECT tag, count(*)::int AS n FROM now.ratings, unnest(tags) AS tag
          WHERE helper_id = $1 AND counted AND NOT held_until_case_closes GROUP BY tag ORDER BY n DESC`,
        [helper.id],
      ),
      pool.query<{ comment: string; stars: number; student_name: string | null; created_at: Date }>(
        `SELECT rt.comment, rt.stars, u.name AS student_name, rt.created_at
           FROM now.ratings rt JOIN origin_users u ON u.id = rt.rater_id
          WHERE rt.helper_id = $1 AND rt.comment IS NOT NULL AND rt.counted AND NOT rt.held_until_case_closes
          ORDER BY rt.created_at DESC LIMIT 10`,
        [helper.id],
      ),
      pool.query<{ stars: number; tags: string[]; created_at: Date }>(
        `SELECT stars, tags, created_at FROM now.ratings WHERE helper_id = $1 AND counted AND NOT held_until_case_closes
          ORDER BY created_at DESC LIMIT 10`,
        [helper.id],
      ),
      pool.query<{ day: string; minutes: number }>(
        `SELECT to_char(minute AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*)::int AS minutes
           FROM now.presence_minutes WHERE helper_id = $1 AND minute >= $2 GROUP BY 1 ORDER BY 1`,
        [helper.id, fourteen],
      ),
      pool.query<{ day: string; sessions: number }>(
        `SELECT to_char(started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*)::int AS sessions
           FROM now.sessions WHERE helper_id = $1 AND started_at >= $2 GROUP BY 1 ORDER BY 1`,
        [helper.id, fourteen],
      ),
      pool.query<{ subject: string; level: string }>(
        `SELECT subject,
                (array_agg(level ORDER BY CASE level WHEN 'expert' THEN 3 WHEN 'verified' THEN 2 ELSE 1 END DESC))[1] AS level
           FROM now.helper_expertise WHERE helper_id = $1 GROUP BY subject ORDER BY subject`,
        [helper.id],
      ),
      pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM now.reports WHERE reported_helper_id = $1 AND status IN ('open', 'upheld') AND created_at >= $2`,
        [helper.id, new Date(now.getTime() - 30 * 24 * 60 * 60_000)],
      ),
      // Earnings history (B90): the last 12 weeks (Monday to Sunday, IST) and the last 20 paid sessions.
      pool.query<{ week: string; sessions: number; tips: number }>(
        `SELECT to_char(date_trunc('week', e.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS week,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'session_capture'), 0)::int AS sessions,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'tip'), 0)::int AS tips
           FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
          WHERE e.account_id = $1 AND e.direction = 'credit' AND t.kind IN ('session_capture', 'tip') AND e.created_at >= $2
          GROUP BY 1 ORDER BY 1`,
        [account, new Date(dayStart.getTime() - 12 * 7 * 24 * 60 * 60_000)],
      ),
      pool.query<{ session_id: string; ended_at: Date; subject: string; difficulty: string; coins: number; tip: number; available_at: Date | null }>(
        `SELECT s.id AS session_id, s.ended_at, r.subject, r.difficulty,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'session_capture'), 0)::int AS coins,
                COALESCE(sum(e.amount) FILTER (WHERE t.kind = 'tip'), 0)::int AS tip,
                max(e.available_at) AS available_at
           FROM now.sessions s
           JOIN now.requests r ON r.id = s.request_id
           JOIN now.ledger_transfers t ON t.request_id = s.request_id AND t.kind IN ('session_capture', 'tip')
           JOIN now.ledger_entries e ON e.transfer_id = t.id AND e.account_id = $2 AND e.direction = 'credit'
          WHERE s.helper_id = $1 AND s.ended_at IS NOT NULL
          GROUP BY s.id, s.ended_at, r.subject, r.difficulty
          ORDER BY s.ended_at DESC LIMIT 20`,
        [helper.id, account],
      ),
      pool.query<{ median_s: number | null }>(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (responded_at - offered_at)))::float AS median_s
           FROM now.offers WHERE helper_id = $1 AND response = 'accepted' AND offered_at >= $2`,
        [helper.id, acceptWindowStart(now)],
      ),
    ]);

  const c = counts.rows[0];
  const o = offers.rows[0];
  const [balance, onlineIds] = await Promise.all([getWalletBalance(solverUserId, now), onlineHelperIds()]);
  const todayKey = istDayKey(now.getTime());
  const notResolvedToday = recentStars.rows.filter((r) => r.tags.includes("not_resolved") && istDayKey(r.created_at.getTime()) === todayKey).length;
  const sessionsByDay = new Map(sessionsDaily.rows.map((r) => [r.day, r.sessions]));
  const allStars = recentStars.rows.map((r) => r.stars);
  const avgStars = allStars.length ? allStars.reduce((a, b) => a + b, 0) / allStars.length : null;

  return {
    profile: {
      helperId: helper.id,
      name: helper.display_name,
      status: helper.verification_status,
      restrictedReason: helper.restricted_reason,
      online: onlineIds.has(helper.id),
    },
    summary: {
      solvedToday: c.today,
      solvedThisWeek: c.week,
      solvedThisMonth: c.month,
      solvedAllTime: c.all_time,
      resolutionRate: ratio(c.resolved, c.with_outcome),
      averageStars: avgStars,
      acceptRate: ratio(o.accepted, o.offers),
      medianAcceptSeconds: o.median_ms === null ? null : Math.round(Number(o.median_ms) / 1000),
    },
    bySubject: bySubject.rows.map((r) => ({
      subject: r.subject,
      chapter: r.chapter,
      solved: r.solved,
      resolutionRate: ratio(r.resolved, r.with_outcome),
      averageStars: r.avg_stars === null ? null : Number(r.avg_stars),
    })),
    byDifficulty: DIFFICULTIES.map((d) => {
      const r = byDifficulty.rows.find((x) => x.difficulty === d);
      return { difficulty: d, solved: r?.solved ?? 0, acceptRate: r ? ratio(r.accepted, r.offers) : null };
    }),
    earnings: {
      daily: earningsDaily.rows,
      thisMonth: { sessions: earningsMonth.rows[0].sessions, tips: earningsMonth.rows[0].tips },
      balance: balance.available,
      pending: balance.pending,
      storeSpendThisMonth: storeSpend.rows[0].spent,
      weekly: earningsWeekly.rows,
      recentSessions: paidSessions.rows.map((r) => ({
        sessionId: r.session_id,
        endedAt: iso(r.ended_at),
        subject: r.subject,
        difficulty: r.difficulty,
        coins: r.coins,
        tip: r.tip,
        pending: r.available_at !== null && r.available_at.getTime() > now.getTime(),
      })),
    },
    feedback: {
      tags: feedback.rows,
      recentComments: comments.rows.map((r) => ({
        comment: r.comment,
        stars: r.stars,
        studentFirstName: firstNameOnly(r.student_name),
        at: iso(r.created_at),
      })),
    },
    activity: activity.rows.map((r) => ({
      day: r.day,
      hoursOnline: Math.round((r.minutes / 60) * 10) / 10,
      sessions: sessionsByDay.get(r.day) ?? 0,
    })),
    standing: {
      levels: expertise.rows,
      warnings: reviewWarnings({ recentStars: allStars, notResolvedToday, reportsIn30Days: reportsRecent.rows[0].n }),
    },
    /** What students may see of this solver (no age, school or contact). */
    publicCard: {
      name: firstNameOnly(helper.display_name),
      subjects: expertise.rows.map((e) => e.subject),
      averageStars: avgStars,
      sessions: c.all_time,
      /** Median time to accept an offer over the last 90 days (PRD §6 "Response"). */
      medianAcceptSeconds: seconds(recentAccept.rows[0]?.median_s ?? null),
    },
  };
}
