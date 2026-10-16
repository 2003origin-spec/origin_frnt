/**
 * After an Origin NOW call (build step 7; plan doc "Ratings, outcome, reports
 * and strikes", "Automatic review", "Targeted practice"):
 *
 * - the student rates (stars, tags, comment) and may tip, once, within 24 h;
 * - either side reports and/or blocks the other, from the room or afterwards;
 * - admins close report cases (upheld / dismissed) and the strike rules follow;
 * - every rating and report re-runs the helper's automatic review;
 * - the student gets 3 OGCode questions on the same concept to practise.
 *
 * The solver's outcome + root cause is recorded by session-service (it is what
 * makes a session payable).
 */

import type { PoolClient } from "pg";

import { sendEmail } from "@/server/email";
import { absoluteHref } from "@/server/email/assets";
import { detailsCard, paragraph, renderEmail } from "@/server/email/layout";
import { sampleOgcodeCatalogQuestionIds } from "@/server/ogcode-catalog";
import { getOgcodePostgresPool } from "@/server/postgres";
import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import {
  PRACTICE_QUESTION_COUNT,
  canReport,
  cleanTags,
  decideStudentSanction,
  ratingAfterCase,
  validateRating,
  type ReportReason,
} from "./after-call-rules";
import { applyTransition, lockRequest, logEvent, type RequestRow } from "./dispatch-service";
import { PLATFORM_ACCOUNTS, tip as tipTransfer, userAccount, type Transfer } from "./ledger-rules";
import { getWalletBalance, postTransfers, withNowTransaction } from "./ledger-store";
import { evaluateAutomaticReview, istDayKey } from "./matching";
import { NowError } from "./now-http";
import { clearPresence, helperStreamId, publishNowEvent, requestStreamId } from "./now-realtime";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { endSession, settleSession } from "./session-service";
import { firstNameOnly } from "./session-rules";
import { RATING_WINDOW_MS, type FeedbackTag } from "./types";

type Effect = () => Promise<void>;

async function runEffects(effects: Effect[]): Promise<void> {
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      console.warn("[origin-now] post-commit effect failed", error instanceof Error ? error.message : error);
    }
  }
}

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type SessionFacts = {
  id: string;
  request_id: string;
  student_id: string;
  helper_id: string;
  solver_kind: "human" | "bot";
  ended_at: Date | null;
  helper_user_id: string | null;
};

async function sessionFacts(client: Pick<PoolClient, "query">, sessionId: string): Promise<SessionFacts | null> {
  const res = await client.query<SessionFacts>(
    `SELECT s.id, s.request_id, s.student_id, s.helper_id, s.solver_kind, s.ended_at, h.user_id AS helper_user_id
       FROM now.sessions s JOIN now.helpers h ON h.id = s.helper_id WHERE s.id = $1`,
    [sessionId],
  );
  return res.rows[0] ?? null;
}

function roleIn(facts: SessionFacts, userId: string): "student" | "solver" | null {
  if (facts.student_id === userId) return "student";
  if (facts.helper_user_id && facts.helper_user_id === userId) return "solver";
  return null;
}

async function setFrozen(client: Pick<PoolClient, "query">, userId: string, frozen: boolean): Promise<void> {
  await client.query(
    `INSERT INTO now.accounts (id, owner_type, owner_id, frozen) VALUES ($1, 'user', $2, $3)
     ON CONFLICT (id) DO UPDATE SET frozen = EXCLUDED.frozen`,
    [userAccount(userId), userId, frozen],
  );
}

// ---------------------------------------------------------------------------
// Rating + tip.

export type RateInput = { stars: number; tags: string[]; comment: string | null; tipCoins: number };

export async function rateSession(studentId: string, sessionId: string, input: RateInput, now: Date = new Date()) {
  const settings = await getNowSettings();
  const errors = validateRating(input, settings.tipCap);
  if (errors.length) throw new NowError(400, "invalid_rating", errors.join(" "));
  const effects: Effect[] = [];
  let helperToReview: string | null = null;

  await withNowTransaction(async (client) => {
    const facts = await sessionFacts(client, sessionId);
    if (!facts || facts.student_id !== studentId) throw new NowError(404, "not_found", "Session not found.");
    const request = (await lockRequest(client, facts.request_id)) as RequestRow;
    if (!facts.ended_at || request.status === "live") throw new NowError(409, "session_live", "Rate the call after it ends.");
    if (request.status === "rated") throw new NowError(409, "already_rated", "You already rated this call.");
    if (request.status !== "ended" || now.getTime() - facts.ended_at.getTime() > RATING_WINDOW_MS) {
      throw new NowError(409, "rating_closed", "The rating window for this call has closed.");
    }
    if (input.tipCoins > 0) {
      const balance = await getWalletBalance(studentId, now);
      if (balance.available < input.tipCoins) throw new NowError(409, "insufficient_coins", "Not enough coins for that tip.");
    }
    // If the solver reported this student on this session, the student's rating waits for the case.
    const solverReport = await client.query(
      `SELECT 1 FROM now.reports WHERE session_id = $1 AND reporter_role = 'solver' AND status = 'open' LIMIT 1`,
      [sessionId],
    );
    const held = (solverReport.rowCount ?? 0) > 0;
    const tags = cleanTags(input.tags);
    await client.query(
      `INSERT INTO now.ratings (id, session_id, rater_id, helper_id, stars, tags, comment, counted, held_until_case_closes, tip_coins, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10)`,
      [createPrefixedId("nrat"), sessionId, studentId, facts.helper_id, input.stars, tags, input.comment?.trim() || null, held, input.tipCoins, now],
    );
    if (input.tipCoins > 0) {
      const transfer: Transfer =
        facts.solver_kind === "human" && facts.helper_user_id
          ? tipTransfer(studentId, facts.helper_user_id, request.id, input.tipCoins, now)
          : {
              kind: "tip",
              from: userAccount(studentId),
              to: PLATFORM_ACCOUNTS.botRevenue,
              amount: input.tipCoins,
              requestId: request.id,
              idempotencyKey: `tip:${request.id}`,
            };
      await postTransfers([transfer], { client, now });
    }
    await applyTransition(client, request, "rated");
    await logEvent(client, {
      type: "session.rated",
      requestId: request.id,
      sessionId,
      actor: studentId,
      payload: { stars: input.stars, tags, tipCoins: input.tipCoins, held },
    });
    if (facts.solver_kind === "human") {
      helperToReview = facts.helper_id;
      effects.push(() =>
        publishNowEvent(helperStreamId(facts.helper_id), { type: "rated", sessionId, stars: input.stars, tipCoins: input.tipCoins }),
      );
    }
  });
  await runEffects(effects);
  if (helperToReview) await runAutomaticReview(helperToReview, sessionId, now);
  return getAfterCall(studentId, sessionId, now);
}

// ---------------------------------------------------------------------------
// Reports + blocks.

export type ReportInput = { reason: ReportReason; details: string | null; block: boolean };

export async function reportSession(userId: string, sessionId: string, input: ReportInput, now: Date = new Date()) {
  const effects: Effect[] = [];
  let reportId = "";
  let helperToReview: string | null = null;
  let endLiveCall = false;

  await withNowTransaction(async (client) => {
    const facts = await sessionFacts(client, sessionId);
    const role = facts ? roleIn(facts, userId) : null;
    if (!facts || !role) throw new NowError(404, "not_found", "Session not found.");
    if (!canReport(facts.ended_at, now)) throw new NowError(409, "report_closed", "This call is too old to report here; contact support.");
    const reportedUser = role === "student" ? facts.helper_user_id : facts.student_id;
    const reportedHelper = role === "student" ? facts.helper_id : null;
    reportId = createPrefixedId("nrep");
    try {
      await client.query(
        `INSERT INTO now.reports (id, session_id, reporter_id, reporter_role, reported_user_id, reported_helper_id, reason, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reportId, sessionId, userId, role, reportedUser, reportedHelper, input.reason, input.details?.trim().slice(0, 2000) || null, now],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new NowError(409, "already_reported", "You already reported this call; we are looking into it.");
      }
      throw error;
    }
    if (input.block && reportedUser) {
      await client.query(`INSERT INTO now.blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, reportedUser]);
    }
    if (role === "solver") {
      // The reported student's rating on this session waits for the case.
      await client.query(`UPDATE now.ratings SET held_until_case_closes = TRUE WHERE session_id = $1 AND rater_id = $2`, [
        sessionId,
        facts.student_id,
      ]);
    } else if (facts.solver_kind === "human" && reportedUser) {
      // A reported solver's coins are frozen until the case closes (plan doc).
      await setFrozen(client, reportedUser, true);
      helperToReview = facts.helper_id;
    }
    await logEvent(client, {
      type: input.reason === "child_safety" ? "report.child_safety" : "report.created",
      requestId: facts.request_id,
      sessionId,
      actor: userId,
      payload: { reportId, reason: input.reason, reporterRole: role, blocked: input.block, live: facts.ended_at === null },
    });
    // A safety report during a live call ends it at once.
    endLiveCall = facts.ended_at === null && (input.reason === "child_safety" || input.reason === "abuse");
    effects.push(() => publishNowEvent(requestStreamId(facts.request_id), { type: "reported", sessionId }));
  });
  await runEffects(effects);
  if (endLiveCall) {
    await endSession({ userId }, sessionId).catch((error) =>
      console.warn("[origin-now] could not end reported call", sessionId, error instanceof Error ? error.message : error),
    );
  }
  if (helperToReview) await runAutomaticReview(helperToReview, sessionId, now);
  return { reportId };
}

export async function blockFromSession(userId: string, sessionId: string) {
  const pool = await db();
  const facts = await sessionFacts(pool, sessionId);
  const role = facts ? roleIn(facts, userId) : null;
  if (!facts || !role) throw new NowError(404, "not_found", "Session not found.");
  const other = role === "student" ? facts.helper_user_id : facts.student_id;
  if (!other) throw new NowError(400, "cannot_block_bot", "The Origin bot cannot be blocked.");
  await pool.query(`INSERT INTO now.blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, other]);
  await logEvent(pool, { type: "block.created", requestId: facts.request_id, sessionId, actor: userId });
  return { blocked: true };
}

// ---------------------------------------------------------------------------
// Automatic review (plan doc): runs inside the rate and report handlers.

export async function runAutomaticReview(helperId: string, sessionId: string | null, now: Date = new Date()) {
  const pool = await db();
  const helper = await pool.query<{ kind: string; verification_status: string; user_id: string | null }>(
    `SELECT kind, verification_status, user_id FROM now.helpers WHERE id = $1`,
    [helperId],
  );
  const row = helper.rows[0];
  // The bot has its own weekly review; a restricted helper is already out.
  if (!row || row.kind !== "human" || row.verification_status !== "verified") return { restricted: false, reasons: [] as string[] };
  const ratings = await pool.query<{ stars: number; tags: FeedbackTag[]; created_at: Date }>(
    `SELECT stars, tags, created_at FROM now.ratings
      WHERE helper_id = $1 AND counted AND NOT held_until_case_closes ORDER BY created_at DESC LIMIT 30`,
    [helperId],
  );
  const reports = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM now.reports WHERE reported_helper_id = $1 AND status IN ('open', 'upheld')`,
    [helperId],
  );
  const result = evaluateAutomaticReview({
    recentRatings: ratings.rows.map((r) => ({ stars: r.stars, tags: r.tags, at: r.created_at.getTime() })),
    upheldOrOpenReportTimes: reports.rows.map((r) => r.created_at.getTime()),
    nowMs: now.getTime(),
    dayKeyOf: istDayKey,
  });
  if (!result.restrict) return { restricted: false, reasons: result.reasons };
  const reason = result.reasons.join(" ");
  const updated = await pool.query(
    `UPDATE now.helpers SET verification_status = 'restricted', restricted_reason = $2, updated_at = NOW()
      WHERE id = $1 AND verification_status = 'verified'`,
    [helperId, reason],
  );
  if (updated.rowCount !== 1) return { restricted: false, reasons: result.reasons };
  await logEvent(pool, { type: "helper.restricted", sessionId, actor: "system", payload: { helperId, reasons: result.reasons } });
  await clearPresence(helperId).catch(() => undefined);
  await publishNowEvent(helperStreamId(helperId), { type: "restricted", reason });
  return { restricted: true, reasons: result.reasons };
}

// ---------------------------------------------------------------------------
// Targeted practice.

async function attemptedQuestionIds(studentId: string): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  try {
    const res = await pool.query<{ question_id: string }>(
      `SELECT question_id FROM ogcode_question_progress WHERE user_id = $1 AND (attempted OR total_attempts > 0) LIMIT 5000`,
      [studentId],
    );
    return res.rows.map((r) => r.question_id);
  } catch {
    return [];
  }
}

/** 3 OGCode questions on the session's concept (then chapter), not yet attempted. */
export async function pickPracticeQuestions(request: Pick<RequestRow, "id" | "student_id" | "subject" | "chapter" | "concept" | "question_id">) {
  const exclude = [request.question_id, ...(await attemptedQuestionIds(request.student_id))];
  const picked: string[] = [];
  const passes = [
    request.concept ? { concepts: [request.concept] } : null,
    request.chapter ? { chapters: [request.chapter] } : null,
  ].filter(Boolean) as ({ concepts: string[] } | { chapters: string[] })[];
  for (const filter of passes) {
    if (picked.length >= PRACTICE_QUESTION_COUNT) break;
    const rows = await sampleOgcodeCatalogQuestionIds({
      subject: request.subject,
      ...filter,
      excludeIds: [...exclude, ...picked],
      seed: request.id,
      limit: PRACTICE_QUESTION_COUNT - picked.length,
    });
    picked.push(...rows.map((r) => r.id));
  }
  return picked;
}

export type AfterCallView = {
  sessionId: string;
  requestId: string;
  role: "student" | "solver";
  status: string;
  canRate: boolean;
  rating: { stars: number; tags: string[]; tipCoins: number } | null;
  tipCap: number;
  outcome: string | null;
  /** Solver only: the outcome can still be recorded (session ended, not yet settled). */
  canRecordOutcome: boolean;
  canReport: boolean;
  reported: boolean;
  /** Student only: OGCode question ids to practise. */
  practice: string[];
  peerName: string;
};

/**
 * What the after-call screen shows. The first time a student sees it, the
 * practice questions are picked and `practice.offered` is logged; later views
 * return the same three.
 */
export async function getAfterCall(userId: string, sessionId: string, now: Date = new Date()): Promise<AfterCallView> {
  const pool = await db();
  const facts = await sessionFacts(pool, sessionId);
  const role = facts ? roleIn(facts, userId) : null;
  if (!facts || !role) throw new NowError(404, "not_found", "Session not found.");
  const req = await pool.query<
    RequestRow & { student_name: string | null; helper_name: string | null; outcome: string | null; settled_at: Date | null }
  >(
    `SELECT r.*, u.name AS student_name, h.display_name AS helper_name, s.outcome, s.settled_at
       FROM now.requests r JOIN origin_users u ON u.id = r.student_id
       JOIN now.sessions s ON s.id = $2 JOIN now.helpers h ON h.id = s.helper_id
      WHERE r.id = $1`,
    [facts.request_id, sessionId],
  );
  const request = req.rows[0];
  const rating = await pool.query<{ stars: number; tags: string[]; tip_coins: number }>(
    `SELECT stars, tags, tip_coins FROM now.ratings WHERE session_id = $1 AND rater_id = $2`,
    [sessionId, facts.student_id],
  );
  const reported = await pool.query(`SELECT 1 FROM now.reports WHERE session_id = $1 AND reporter_id = $2 LIMIT 1`, [
    sessionId,
    userId,
  ]);
  let practice: string[] = [];
  if (role === "student" && facts.ended_at) {
    // Picked once per session; the lock stops two first loads (React dev double
    // effects, two tabs) from picking and logging twice.
    practice = await withNowTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`now-practice:${sessionId}`]);
      const offered = await client.query<{ payload: { questionIds?: string[] } }>(
        `SELECT payload FROM now.events WHERE session_id = $1 AND type = 'practice.offered' ORDER BY id LIMIT 1`,
        [sessionId],
      );
      if (offered.rows[0]) return offered.rows[0].payload.questionIds ?? [];
      const picked = await pickPracticeQuestions(request);
      await logEvent(client, {
        type: "practice.offered",
        requestId: request.id,
        sessionId,
        actor: userId,
        payload: { questionIds: picked, concept: request.concept, chapter: request.chapter },
      });
      return picked;
    });
  }
  const settings = await getNowSettings();
  return {
    sessionId,
    requestId: request.id,
    role,
    status: request.status,
    canRate:
      role === "student" &&
      request.status === "ended" &&
      rating.rows.length === 0 &&
      facts.ended_at !== null &&
      now.getTime() - facts.ended_at.getTime() <= RATING_WINDOW_MS,
    rating: rating.rows[0] ? { stars: rating.rows[0].stars, tags: rating.rows[0].tags, tipCoins: rating.rows[0].tip_coins } : null,
    tipCap: settings.tipCap,
    outcome: request.outcome,
    canRecordOutcome: role === "solver" && facts.solver_kind === "human" && facts.ended_at !== null && request.settled_at === null,
    canReport: canReport(facts.ended_at, now) && (reported.rowCount ?? 0) === 0,
    reported: (reported.rowCount ?? 0) > 0,
    practice,
    peerName: role === "student" ? (facts.solver_kind === "bot" ? "Origin" : (request.helper_name ?? "Solver")) : firstNameOnly(request.student_name),
  };
}

/** The student opened one of the practice questions (dedupe per question). */
export async function recordPracticeAttempt(studentId: string, sessionId: string, questionId: string) {
  const pool = await db();
  const facts = await sessionFacts(pool, sessionId);
  if (!facts || facts.student_id !== studentId) throw new NowError(404, "not_found", "Session not found.");
  const offered = await pool.query<{ payload: { questionIds?: string[] } }>(
    `SELECT payload FROM now.events WHERE session_id = $1 AND type = 'practice.offered' ORDER BY id LIMIT 1`,
    [sessionId],
  );
  if (!offered.rows[0]?.payload.questionIds?.includes(questionId)) {
    throw new NowError(400, "not_offered", "That question was not part of this practice set.");
  }
  const seen = await pool.query(
    `SELECT 1 FROM now.events WHERE session_id = $1 AND type = 'practice.attempted' AND payload->>'questionId' = $2 LIMIT 1`,
    [sessionId, questionId],
  );
  if ((seen.rowCount ?? 0) === 0) {
    await logEvent(pool, { type: "practice.attempted", requestId: facts.request_id, sessionId, actor: studentId, payload: { questionId } });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: report cases and strikes.

export type ReportCase = {
  id: string;
  status: string;
  reason: string;
  details: string | null;
  reporterRole: string | null;
  reporterId: string;
  reportedUserId: string | null;
  reportedHelperId: string | null;
  sessionId: string | null;
  requestId: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  hasRecording: boolean;
};

export async function listReportsForAdmin(status: "open" | "upheld" | "dismissed" = "open"): Promise<ReportCase[]> {
  const pool = await db();
  const res = await pool.query(
    `SELECT r.*, s.request_id, (s.recording_key IS NOT NULL) AS has_recording
       FROM now.reports r LEFT JOIN now.sessions s ON s.id = r.session_id
      WHERE r.status = $1
      ORDER BY (r.reason = 'child_safety') DESC, r.created_at ASC LIMIT 200`,
    [status],
  );
  return res.rows.map(mapCase);
}

function mapCase(r: Record<string, unknown>): ReportCase {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
  return {
    id: String(r.id),
    status: String(r.status),
    reason: String(r.reason),
    details: (r.details as string | null) ?? null,
    reporterRole: (r.reporter_role as string | null) ?? null,
    reporterId: String(r.reporter_id),
    reportedUserId: (r.reported_user_id as string | null) ?? null,
    reportedHelperId: (r.reported_helper_id as string | null) ?? null,
    sessionId: (r.session_id as string | null) ?? null,
    requestId: (r.request_id as string | null) ?? null,
    createdAt: iso(r.created_at) ?? "",
    firstResponseAt: iso(r.first_response_at),
    reviewedAt: iso(r.reviewed_at),
    resolutionNote: (r.resolution_note as string | null) ?? null,
    hasRecording: Boolean(r.has_recording),
  };
}

/** Opening a case counts as the first response (the 24 h child-safety promise). */
export async function getReportForAdmin(adminId: string, reportId: string) {
  const pool = await db();
  await pool.query(`UPDATE now.reports SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL`, [reportId]);
  const res = await pool.query(
    `SELECT r.*, s.request_id, (s.recording_key IS NOT NULL) AS has_recording
       FROM now.reports r LEFT JOIN now.sessions s ON s.id = r.session_id WHERE r.id = $1`,
    [reportId],
  );
  if (!res.rows[0]) throw new NowError(404, "not_found", "Report not found.");
  const report = mapCase(res.rows[0]);
  const events = report.sessionId
    ? await pool.query(`SELECT type, actor, at, payload FROM now.events WHERE session_id = $1 ORDER BY id`, [report.sessionId])
    : { rows: [] };
  await logEvent(pool, { type: "report.viewed", sessionId: report.sessionId, actor: adminId, payload: { reportId } });
  return { report, events: events.rows };
}

export async function resolveReport(
  adminId: string,
  reportId: string,
  outcome: "upheld" | "dismissed",
  note: string,
  now: Date = new Date(),
) {
  const effects: Effect[] = [];
  let helperToReview: string | null = null;
  let sessionToSettle: string | null = null;
  await withNowTransaction(async (client) => {
    const res = await client.query(`SELECT * FROM now.reports WHERE id = $1 FOR UPDATE`, [reportId]);
    const report = res.rows[0];
    if (!report) throw new NowError(404, "not_found", "Report not found.");
    if (report.status !== "open") throw new NowError(409, "already_closed", "This case is already closed.");
    await client.query(
      `UPDATE now.reports SET status = $2, reviewed_by = $3, reviewed_at = $4, resolution_note = $5,
              first_response_at = COALESCE(first_response_at, $4)
        WHERE id = $1`,
      [reportId, outcome, adminId, now, note.trim().slice(0, 1000)],
    );
    if (report.session_id && report.reporter_role === "student") sessionToSettle = report.session_id;
    // The reported side's rating on this session stops waiting.
    if (report.reporter_role === "solver" && report.session_id && report.reported_user_id) {
      const after = ratingAfterCase(outcome);
      await client.query(
        `UPDATE now.ratings SET held_until_case_closes = FALSE, counted = $3 WHERE session_id = $1 AND rater_id = $2`,
        [report.session_id, report.reported_user_id, after.counted],
      );
    }
    await logEvent(client, {
      type: `report.${outcome}`,
      sessionId: report.session_id,
      actor: adminId,
      payload: { reportId, reason: report.reason },
    });

    if (report.reported_helper_id && report.reported_user_id) {
      const helperUserId: string = report.reported_user_id;
      const helperId: string = report.reported_helper_id;
      if (outcome === "upheld") {
        // Any upheld report suspends a solver at once; coins stay frozen until an admin reinstates them.
        await client.query(
          `UPDATE now.helpers SET verification_status = 'restricted', restricted_reason = $2, updated_at = NOW()
            WHERE id = $1 AND verification_status <> 'rejected'`,
          [helperId, `Upheld report (${report.reason}).`],
        );
        await client.query(
          `INSERT INTO now.suspensions (id, user_id, scope, reason, report_id, starts_at, ends_at, created_by)
           VALUES ($1, $2, 'solver', $3, $4, $5, NULL, $6)`,
          [createPrefixedId("nsus"), helperUserId, `Upheld report (${report.reason})`, reportId, now, adminId],
        );
        await logEvent(client, { type: "helper.restricted", sessionId: report.session_id, actor: adminId, payload: { helperId, reportId } });
        effects.push(
          () => clearPresence(helperId),
          () => publishNowEvent(helperStreamId(helperId), { type: "restricted", reason: "A report about one of your calls was upheld." }),
        );
      } else {
        await unfreezeIfClear(client, helperUserId, helperId);
        helperToReview = helperId;
      }
    } else if (report.reporter_role === "solver" && report.reported_user_id && outcome === "upheld") {
      const studentId: string = report.reported_user_id;
      const upheld = await client.query<{ reason: ReportReason; reviewed_at: Date }>(
        `SELECT reason, reviewed_at FROM now.reports
          WHERE reported_user_id = $1 AND reporter_role = 'solver' AND status = 'upheld' ORDER BY reviewed_at`,
        [studentId],
      );
      const sanction = decideStudentSanction(
        upheld.rows.map((r) => ({ reason: r.reason, at: r.reviewed_at })),
        now,
      );
      if (sanction.kind === "suspend") {
        await client.query(
          `INSERT INTO now.suspensions (id, user_id, scope, reason, report_id, starts_at, ends_at, created_by)
           VALUES ($1, $2, 'student', $3, $4, $5, $6, $7)`,
          [createPrefixedId("nsus"), studentId, sanction.reason, reportId, now, sanction.until, adminId],
        );
        await logEvent(client, {
          type: "student.suspended",
          sessionId: report.session_id,
          actor: adminId,
          payload: { studentId, until: sanction.until?.toISOString() ?? null, reason: sanction.reason },
        });
        if (sanction.notifyGuardian) effects.push(() => notifyGuardianOfSuspension(studentId, sanction.until, report.session_id));
      }
    }
  });
  await runEffects(effects);
  if (helperToReview) await runAutomaticReview(helperToReview, null, now);
  // A case closing can release a session whose coins waited for it.
  if (sessionToSettle) {
    await settleSession(sessionToSettle, now).catch((error) =>
      console.error("[origin-now] settle after case failed", sessionToSettle, error instanceof Error ? error.message : error),
    );
  }
  return { reportId, status: outcome };
}

/** A solver's wallet thaws only when no report against them is open and they are not suspended. */
async function unfreezeIfClear(client: Pick<PoolClient, "query">, helperUserId: string, helperId: string): Promise<boolean> {
  const blockers = await client.query(
    `SELECT 1 FROM now.reports WHERE reported_helper_id = $1 AND status = 'open'
     UNION ALL
     SELECT 1 FROM now.suspensions WHERE user_id = $2 AND scope = 'solver' AND lifted_at IS NULL
       AND (ends_at IS NULL OR ends_at > NOW())
     LIMIT 1`,
    [helperId, helperUserId],
  );
  if ((blockers.rowCount ?? 0) > 0) return false;
  // A wallet frozen because a refunded coin pack had already been spent stays
  // frozen until an admin unfreezes it on purpose (People → wallet).
  const shortfall = await client.query(
    `SELECT 1 FROM now.events e
      WHERE e.type = 'wallet.refund_shortfall' AND e.payload->>'userId' = $1
        AND NOT EXISTS (SELECT 1 FROM now.events u WHERE u.type = 'wallet.unfrozen' AND u.payload->>'userId' = $1 AND u.id > e.id)
      LIMIT 1`,
    [helperUserId],
  );
  if ((shortfall.rowCount ?? 0) > 0) return false;
  await setFrozen(client, helperUserId, false);
  return true;
}

/** Admin: freeze or unfreeze a wallet by hand, with a reason (logged). */
export async function setWalletFrozenByAdmin(adminId: string, userId: string, frozen: boolean, reason: string) {
  await withNowTransaction(async (client) => {
    await setFrozen(client, userId, frozen);
    await logEvent(client, {
      type: frozen ? "wallet.frozen" : "wallet.unfrozen",
      actor: adminId,
      payload: { userId, reason: reason.slice(0, 300) },
    });
  });
  return { userId, frozen };
}

export async function liftSuspension(adminId: string, suspensionId: string) {
  await withNowTransaction(async (client) => {
    const res = await client.query<{ user_id: string; scope: string; lifted_at: Date | null }>(
      `UPDATE now.suspensions SET lifted_at = NOW(), lifted_by = $2 WHERE id = $1 AND lifted_at IS NULL RETURNING user_id, scope, lifted_at`,
      [suspensionId, adminId],
    );
    const row = res.rows[0];
    if (!row) throw new NowError(404, "not_found", "No active suspension with that id.");
    if (row.scope === "solver") {
      // Rolls back: a solver comes back through Reinstate, which also checks reports and the wallet.
      throw new NowError(409, "use_reinstate", "Reinstate the solver from Solvers & metrics instead.");
    }
    await logEvent(client, { type: "suspension.lifted", actor: adminId, payload: { suspensionId, userId: row.user_id, scope: row.scope } });
  });
  return { lifted: true };
}

/** Admin clears a restricted solver back to verified (automatic review or an upheld report). */
export async function reinstateHelper(adminId: string, helperId: string, note: string) {
  await withNowTransaction(async (client) => {
    const res = await client.query<{ user_id: string | null }>(
      `UPDATE now.helpers SET verification_status = 'verified', restricted_reason = NULL, updated_at = NOW()
        WHERE id = $1 AND verification_status = 'restricted' RETURNING user_id`,
      [helperId],
    );
    const userId = res.rows[0]?.user_id;
    if (!userId) throw new NowError(409, "not_restricted", "This solver is not restricted.");
    await client.query(
      `UPDATE now.suspensions SET lifted_at = NOW(), lifted_by = $2 WHERE user_id = $1 AND scope = 'solver' AND lifted_at IS NULL`,
      [userId, adminId],
    );
    await unfreezeIfClear(client, userId, helperId);
    await logEvent(client, { type: "helper.reinstated", actor: adminId, payload: { helperId, note: note.slice(0, 500) } });
  });
  return { reinstated: true };
}

export async function listSuspensionsForUser(userId: string) {
  const pool = await db();
  const res = await pool.query(
    `SELECT id, scope, reason, starts_at, ends_at, lifted_at FROM now.suspensions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    reason: r.reason,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at ? r.ends_at.toISOString() : null,
    liftedAt: r.lifted_at ? r.lifted_at.toISOString() : null,
    active: !r.lifted_at && (!r.ends_at || r.ends_at.getTime() > Date.now()),
  }));
}

export async function listRestrictedHelpers() {
  const pool = await db();
  const res = await pool.query(
    `SELECT h.id, h.user_id, h.display_name, h.restricted_reason, h.updated_at,
            (SELECT count(*)::int FROM now.reports r WHERE r.reported_helper_id = h.id AND r.status = 'open') AS open_reports
       FROM now.helpers h WHERE h.verification_status = 'restricted' ORDER BY h.updated_at DESC`,
  );
  return res.rows;
}

async function notifyGuardianOfSuspension(studentId: string, until: Date | null, sessionId: string | null): Promise<void> {
  const pool = await db();
  const res = await pool.query<{ guardian_name: string; guardian_email: string | null; child_name: string | null }>(
    `SELECT g.guardian_name, g.guardian_email, u.name AS child_name
       FROM app.guardian_consents g JOIN origin_users u ON u.id = g.user_id
      WHERE g.user_id = $1 AND g.purpose = 'student' AND g.withdrawn_at IS NULL AND g.guardian_email IS NOT NULL
      ORDER BY g.consented_at DESC LIMIT 1`,
    [studentId],
  );
  const guardian = res.rows[0];
  if (!guardian?.guardian_email) {
    // Adults have no guardian on file; nothing to send.
    await logEvent(pool, { type: "guardian.notify_skipped", sessionId, actor: "system", payload: { studentId } });
    return;
  }
  const child = firstNameOnly(guardian.child_name);
  const when = until ? `until ${until.toISOString().slice(0, 10)}` : "until our team has reviewed it";
  const subject = `Origin NOW: ${child}'s live help is paused`;
  const text = [
    `Dear ${guardian.guardian_name},`,
    ``,
    `After reviewing a report about one of ${child}'s Origin NOW calls, we have paused ${child}'s access to live help ${when}.`,
    `Practice, tests and everything else on Origin keep working as usual.`,
    `If you have questions, reply to this email or write to the grievance officer listed at ${absoluteHref("/privacy-policy")}.`,
  ].join("\n");
  const html = renderEmail({
    preheader: `${child}'s live help on Origin NOW is paused.`,
    documentTitle: "Origin - Live help paused",
    title: "Live help",
    titleAccent: "is paused",
    intro: [`After reviewing a report about one of ${child}'s Origin NOW calls, we have paused live help ${when}.`],
    blocks: [
      detailsCard("What this means", [
        { label: "Paused", value: "Live help calls (Origin NOW)" },
        { label: "Still open", value: "Practice, tests and everything else" },
      ]),
      paragraph("If you have questions, reply to this email or contact the grievance officer named in our privacy policy.", { muted: true }),
    ],
  });
  const sent = await sendEmail({ to: guardian.guardian_email, subject, text, html });
  await logEvent(pool, {
    type: sent.success ? "guardian.notified" : "guardian.notify_failed",
    sessionId,
    actor: "system",
    payload: { studentId },
  });
}
