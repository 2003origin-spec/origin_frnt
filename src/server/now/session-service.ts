/**
 * Origin NOW connected sessions (build step 5; plan doc, "Session rules" and
 * "Coin ledger invariants"): join, no-show, end + settle, extensions, the
 * QStash timer entry point, and the sweep / nightly backstops.
 *
 * Same discipline as dispatch-service: one transaction holding the request row
 * lock, transitions only via session-state, side effects after commit.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { loadPriceTable } from "./admin-store";
import {
  applyTransition,
  dispatchRequest,
  dispatchSafely,
  expireOffer,
  getHelperByUserId,
  lockRequest,
  logEvent,
  releaseHold,
  type RequestRow,
} from "./dispatch-service";
import { findUnbalancedTransfers, sessionCapture, sessionHold } from "./ledger-rules";
import { getWalletBalance, loadAllLegsForAudit, postTransfers, withNowTransaction } from "./ledger-store";
import { purgeOldDeliveryAddresses } from "./merch-service";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { helperStreamId, publishNowEvent, requestStreamId, scheduleNowTimer, type NowTimer } from "./now-realtime";
import { getNowSettings } from "./now-settings";
import { botIsInRoom, closeRoom, purgeExpiredRecordings, startSessionRecording } from "./room-service";
import { checkExtension, lookupPrice, sessionLengthMinutes } from "./pricing";
import {
  OVERRUN_GRACE_MS,
  decidePayable,
  settlementReportState,
  isExtensionRequestOpen,
  isShortSession,
  noShowSide,
  sessionEndsAt,
} from "./session-rules";
import { payEveningBonuses, type EveningBonusRun } from "./evening-bonus-service";
import { NO_SHOW_WINDOW_MS, RATING_WINDOW_MS, type Outcome, type RootCause, type SolverKind } from "./types";

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

export type SessionRow = {
  id: string;
  request_id: string;
  helper_id: string;
  student_id: string;
  solver_kind: SolverKind;
  livekit_room: string;
  accepted_at: Date;
  student_joined_at: Date | null;
  helper_joined_at: Date | null;
  started_at: Date | null;
  ends_at: Date | null;
  ended_at: Date | null;
  ended_by: string | null;
  extensions_used: number;
  extension_requested_at: Date | null;
  outcome: Outcome | null;
  root_cause: RootCause | null;
  payable: boolean | null;
  settled_at: Date | null;
};

/** Locks the request first, then reads the session (always the same lock order). */
async function lockSession(
  client: PoolClient,
  sessionId: string,
): Promise<{ session: SessionRow; request: RequestRow } | null> {
  const head = await client.query<{ request_id: string }>(`SELECT request_id FROM now.sessions WHERE id = $1`, [sessionId]);
  const requestId = head.rows[0]?.request_id;
  if (!requestId) return null;
  const request = await lockRequest(client, requestId);
  const res = await client.query<SessionRow>(`SELECT * FROM now.sessions WHERE id = $1 FOR UPDATE`, [sessionId]);
  const session = res.rows[0];
  if (!request || !session) return null;
  return { session, request };
}

type Role = "student" | "helper";

async function roleOf(userId: string, session: SessionRow): Promise<Role> {
  if (session.student_id === userId) return "student";
  const helper = await getHelperByUserId(userId);
  if (helper && helper.id === session.helper_id) return "helper";
  throw new NowError(404, "not_found", "Session not found.");
}

async function priceRowFor(request: RequestRow, solverKind: SolverKind) {
  const { rows } = await loadPriceTable();
  const row = lookupPrice(rows, request.difficulty, solverKind);
  if (!row) throw new NowError(503, "no_price", "Live help is not priced yet.");
  return row;
}

function scheduleSessionTimers(effects: Effect[], sessionId: string, endsAt: Date, now: Date): void {
  const secondsLeft = (endsAt.getTime() - now.getTime()) / 1000;
  effects.push(async () => {
    if (secondsLeft > 75) await scheduleNowTimer({ kind: "session_warn", sessionId }, secondsLeft - 60);
    await scheduleNowTimer({ kind: "session_end", sessionId, endsAt: endsAt.toISOString() }, secondsLeft + 1);
  });
}

// ---------------------------------------------------------------------------
// Join.

export async function joinSession(userId: string, sessionId: string, now: Date = new Date()) {
  const effects: Effect[] = [];
  let live = false;
  // Ask LiveKit before taking any row lock (a network call must not hold one).
  const head = await (await db()).query<{ solver_kind: SolverKind; helper_joined_at: Date | null }>(
    `SELECT solver_kind, helper_joined_at FROM now.sessions WHERE id = $1`,
    [sessionId],
  );
  const botPresent = head.rows[0]?.solver_kind === "bot" && !head.rows[0].helper_joined_at ? await botIsInRoom(sessionId) : false;
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) throw new NowError(404, "not_found", "Session not found.");
    const { session, request } = locked;
    const role = await roleOf(userId, session);
    if (session.ended_at) throw new NowError(409, "session_ended", "This session has ended.");
    if (request.status !== "accepted" && request.status !== "live") {
      throw new NowError(409, "invalid_state", "This session is not open.");
    }
    const column = role === "student" ? "student_joined_at" : "helper_joined_at";
    if (!session[column]) {
      await client.query(`UPDATE now.sessions SET ${column} = $2 WHERE id = $1`, [session.id, now]);
      session[column] = now;
      await logEvent(client, { type: `session.${role}_joined`, requestId: request.id, sessionId: session.id, actor: userId });
    }
    // The bot counts as joined only once LiveKit shows its agent in the room, so
    // a student is never charged for a bot that never arrived (the student's
    // client calls join again when the agent appears).
    if (session.solver_kind === "bot" && !session.helper_joined_at && botPresent) {
      await client.query(`UPDATE now.sessions SET helper_joined_at = $2 WHERE id = $1`, [session.id, now]);
      session.helper_joined_at = now;
      await logEvent(client, { type: "session.bot_joined", requestId: request.id, sessionId: session.id, actor: "system" });
    }
    if (request.status === "accepted" && session.student_joined_at && session.helper_joined_at) {
      const price = await priceRowFor(request, session.solver_kind);
      const endsAt = sessionEndsAt(now, sessionLengthMinutes(price, session.extensions_used));
      await client.query(`UPDATE now.sessions SET started_at = $2, ends_at = $3 WHERE id = $1`, [session.id, now, endsAt]);
      await applyTransition(client, request, "both_joined", { connected_at: now });
      await logEvent(client, {
        type: "session.started",
        requestId: request.id,
        sessionId: session.id,
        actor: "system",
        payload: { endsAt: endsAt.toISOString(), waitMs: now.getTime() - request.created_at.getTime() },
      });
      live = true;
      effects.push(
        () => publishNowEvent(requestStreamId(request.id), { type: "live", sessionId: session.id, endsAt: endsAt.toISOString() }),
        async () => {
          await startSessionRecording(session.id, request.id);
        },
      );
      scheduleSessionTimers(effects, session.id, endsAt, now);
    } else {
      effects.push(() => publishNowEvent(requestStreamId(request.id), { type: "joined", sessionId: session.id, role }));
    }
  });
  await runEffects(effects);
  return { sessionId, live };
}

// ---------------------------------------------------------------------------
// No-show.

/** Runs from the no-show timer and the sweep. Idempotent. */
export async function handleNoShow(sessionId: string, now: Date = new Date()): Promise<"helper" | "student" | "both" | null> {
  const effects: Effect[] = [];
  let side: "helper" | "student" | "both" | null = null;
  let requeue: string | null = null;
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) return;
    const { session, request } = locked;
    if (session.ended_at || request.status !== "accepted") return;
    const verdict = noShowSide({
      acceptedAt: session.accepted_at,
      studentJoinedAt: session.student_joined_at,
      helperJoinedAt: session.helper_joined_at,
      now,
    });
    if (verdict !== "helper" && verdict !== "student" && verdict !== "both") return;
    side = verdict;
    await client.query(
      `UPDATE now.sessions SET ended_at = $2, ended_by = 'no_show', payable = FALSE, settled_at = $2 WHERE id = $1`,
      [session.id, now],
    );
    if (verdict === "helper") {
      // The solver accepted and vanished: back to the queue without them; the hold stays.
      await applyTransition(client, request, "helper_no_show", {
        helper_id: null,
        solver_kind: null,
        current_offer_id: null,
        excluded_helper_ids: [...new Set([...request.excluded_helper_ids, session.helper_id])],
        failed_offers: request.failed_offers + 1,
      });
      await logEvent(client, {
        type: "session.helper_no_show",
        requestId: request.id,
        sessionId: session.id,
        actor: "system",
        payload: { helperId: session.helper_id },
      });
      requeue = request.id;
      const helperId = session.helper_id;
      effects.push(
        () => publishNowEvent(requestStreamId(request.id), { type: "status", status: "requested", note: "solver_no_show" }),
        () => publishNowEvent(helperStreamId(helperId), { type: "session_lost", sessionId: session.id }),
        () => closeRoom(session.id),
      );
    } else {
      await applyTransition(client, request, "student_no_show", { closed_reason: "no_show", closed_at: now });
      await releaseHold(client, request);
      await logEvent(client, {
        type: verdict === "both" ? "session.nobody_joined" : "session.student_no_show",
        requestId: request.id,
        sessionId: session.id,
        actor: "system",
      });
      effects.push(
        () => publishNowEvent(requestStreamId(request.id), { type: "closed", reason: "no_show" }),
        () => closeRoom(session.id),
      );
    }
  });
  await runEffects(effects);
  if (requeue) await dispatchSafely(requeue, now, "solver no-show");
  return side;
}

// ---------------------------------------------------------------------------
// End + settle.

export type EndInput = { outcome?: Outcome | null; rootCause?: RootCause | null };

export async function endSession(
  actor: { userId: string } | { system: "timer" | "admin" },
  sessionId: string,
  input: EndInput = {},
  now: Date = new Date(),
) {
  const effects: Effect[] = [];
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) throw new NowError(404, "not_found", "Session not found.");
    const { session, request } = locked;
    const endedBy = "system" in actor ? actor.system : await roleOf(actor.userId, session);
    if (session.ended_at) return;
    if (request.status !== "live") throw new NowError(409, "invalid_state", "This session has not started.");
    if (endedBy === "timer" && session.ends_at && session.ends_at.getTime() > now.getTime() + 1_000) return;
    // Only the solver reports the outcome.
    const outcome = endedBy === "helper" ? (input.outcome ?? null) : null;
    const rootCause = endedBy === "helper" ? (input.rootCause ?? null) : null;
    await client.query(
      `UPDATE now.sessions SET ended_at = $2, ended_by = $3, extension_requested_at = NULL,
              outcome = COALESCE($4, outcome), root_cause = COALESCE($5, root_cause)
        WHERE id = $1`,
      [session.id, now, endedBy, outcome, rootCause],
    );
    Object.assign(session, { ended_at: now, ended_by: endedBy, outcome: outcome ?? session.outcome });
    await applyTransition(client, request, "session_ended");
    await logEvent(client, {
      type: "session.ended",
      requestId: request.id,
      sessionId: session.id,
      actor: "userId" in actor ? actor.userId : "system",
      payload: {
        endedBy,
        durationMs: session.started_at ? now.getTime() - session.started_at.getTime() : 0,
        extensionsUsed: session.extensions_used,
      },
    });
    if (isShortSession(session.started_at, now)) {
      await logEvent(client, { type: "session.short", requestId: request.id, sessionId: session.id, actor: "system" });
    }
    // Bots never report an outcome; a human session settles once the solver has.
    if (session.solver_kind === "bot" || session.outcome) await settleLocked(client, session, request, now, effects);
    // The server ends the call: deleting the room disconnects both people (a token's expiry would not).
    effects.push(
      () => publishNowEvent(requestStreamId(request.id), { type: "ended", sessionId: session.id, endedBy }),
      () => closeRoom(session.id),
    );
    if (session.solver_kind === "human") {
      effects.push(() => publishNowEvent(helperStreamId(session.helper_id), { type: "ended", sessionId: session.id, endedBy }));
    }
  });
  await runEffects(effects);
  return { sessionId };
}

/** The solver's after-call outcome; settles the session if it was waiting on it. */
export async function recordOutcome(
  helperUserId: string,
  sessionId: string,
  outcome: Outcome,
  rootCause: RootCause | null,
  now: Date = new Date(),
) {
  const effects: Effect[] = [];
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) throw new NowError(404, "not_found", "Session not found.");
    const { session, request } = locked;
    if ((await roleOf(helperUserId, session)) !== "helper") throw new NowError(403, "forbidden", "Only the solver reports the outcome.");
    if (!session.ended_at) throw new NowError(409, "session_live", "End the session first.");
    if (session.settled_at) throw new NowError(409, "already_settled", "The outcome window has closed.");
    await client.query(`UPDATE now.sessions SET outcome = $2, root_cause = $3 WHERE id = $1`, [session.id, outcome, rootCause]);
    session.outcome = outcome;
    session.root_cause = rootCause;
    await logEvent(client, {
      type: "session.outcome",
      requestId: request.id,
      sessionId: session.id,
      actor: session.helper_id,
      payload: { outcome, rootCause },
    });
    await settleLocked(client, session, request, now, effects);
  });
  await runEffects(effects);
  return { sessionId };
}

/**
 * Moves the held coins exactly once: to the solver (pending 24 h) or the bot
 * revenue account when payable, back to the student otherwise.
 */
async function settleLocked(
  client: PoolClient,
  session: SessionRow,
  request: RequestRow,
  now: Date,
  effects: Effect[],
): Promise<"settled" | "deferred" | "already"> {
  if (session.settled_at) return "already";
  const facts = await client.query<{ user_id: string | null; linked_user_ids: string[] }>(
    `SELECT h.user_id, h.linked_user_ids FROM now.helpers h WHERE h.id = $1`,
    [session.helper_id],
  );
  const reports = await client.query<{ reporter_role: string | null; status: string }>(
    `SELECT reporter_role, status FROM now.reports WHERE session_id = $1`,
    [session.id],
  );
  const reportState = settlementReportState(reports.rows.map((r) => ({ reporterRole: r.reporter_role, status: r.status })));
  if (reportState === "defer") {
    // The student reported the solver: the coins stay held until the case closes
    // (resolveReport settles it then), so a dismissed report costs the solver nothing.
    return "deferred";
  }
  const helper = facts.rows[0];
  const ownOrLinked =
    Boolean(helper?.user_id) &&
    (helper!.user_id === session.student_id || (helper!.linked_user_ids ?? []).includes(session.student_id));
  const payable = decidePayable({
    solverKind: session.solver_kind,
    studentJoined: Boolean(session.student_joined_at),
    helperJoined: Boolean(session.helper_joined_at),
    outcome: session.outcome,
    ownOrLinkedAccount: ownOrLinked,
    reportUpheld: reportState === "upheld",
  });
  const held = request.held_coins;
  if (payable && held > 0) {
    const settings = await getNowSettings();
    await postTransfers(
      sessionCapture({
        requestId: request.id,
        heldCoins: held,
        solverKind: session.solver_kind,
        solverUserId: helper?.user_id ?? null,
        commissionBps: settings.commissionBps,
        endedAt: session.ended_at ?? now,
      }),
      { client, now },
    );
    await client.query(`UPDATE now.requests SET held_coins = 0 WHERE id = $1`, [request.id]);
    request.held_coins = 0;
  } else {
    await releaseHold(client, request);
  }
  await client.query(`UPDATE now.sessions SET payable = $2, settled_at = $3 WHERE id = $1`, [session.id, payable, now]);
  session.payable = payable;
  session.settled_at = now;
  await logEvent(client, {
    type: "session.settled",
    requestId: request.id,
    sessionId: session.id,
    actor: "system",
    payload: { payable, coins: held, ownOrLinked, reportUpheld: reportState === "upheld" },
  });
  effects.push(() => publishNowEvent(requestStreamId(request.id), { type: "settled", sessionId: session.id, payable }));
  return "settled";
}

// ---------------------------------------------------------------------------
// Extensions: the student asks, the solver agrees, the student pays.

export async function requestExtension(studentId: string, sessionId: string, now: Date = new Date()) {
  const effects: Effect[] = [];
  let autoConfirm = false;
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) throw new NowError(404, "not_found", "Session not found.");
    const { session, request } = locked;
    if ((await roleOf(studentId, session)) !== "student") throw new NowError(403, "forbidden", "Only the student can ask for more time.");
    if (request.status !== "live" || session.ended_at) throw new NowError(409, "invalid_state", "The session is not live.");
    const price = await priceRowFor(request, session.solver_kind);
    const balance = await getWalletBalance(studentId, now);
    const check = checkExtension(price, session.extensions_used, balance.available);
    if (!check.ok) {
      throw new NowError(409, check.reason, check.reason === "max_reached" ? "No more extensions for this session." : "Not enough coins for more time.");
    }
    if (isExtensionRequestOpen(session.extension_requested_at, now)) return;
    await client.query(`UPDATE now.sessions SET extension_requested_at = $2 WHERE id = $1`, [session.id, now]);
    await logEvent(client, {
      type: "extension.requested",
      requestId: request.id,
      sessionId: session.id,
      actor: studentId,
      payload: { coins: check.coins, minutes: check.minutes },
    });
    autoConfirm = session.solver_kind === "bot";
    if (!autoConfirm) {
      // The room listens on the request stream; the solver's shift screen on its own.
      effects.push(() =>
        publishNowEvent(requestStreamId(request.id), {
          type: "extension_requested",
          sessionId: session.id,
          minutes: check.minutes,
          coins: check.coins,
        }),
      );
      effects.push(() =>
        publishNowEvent(helperStreamId(session.helper_id), {
          type: "extension_requested",
          sessionId: session.id,
          minutes: check.minutes,
        }),
      );
    }
  });
  await runEffects(effects);
  if (autoConfirm) return confirmExtension({ bot: true }, sessionId, now);
  return { sessionId, pending: true };
}

export async function confirmExtension(actor: { helperUserId: string } | { bot: true }, sessionId: string, now: Date = new Date()) {
  const effects: Effect[] = [];
  let endsAtOut: string | null = null;
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked) throw new NowError(404, "not_found", "Session not found.");
    const { session, request } = locked;
    if ("helperUserId" in actor && (await roleOf(actor.helperUserId, session)) !== "helper") {
      throw new NowError(403, "forbidden", "Only the solver can confirm more time.");
    }
    if (request.status !== "live" || session.ended_at || !session.ends_at) {
      throw new NowError(409, "invalid_state", "The session is not live.");
    }
    if (!isExtensionRequestOpen(session.extension_requested_at, now)) {
      throw new NowError(409, "no_extension_request", "The student's request for more time has lapsed.");
    }
    const price = await priceRowFor(request, session.solver_kind);
    const balance = await getWalletBalance(session.student_id, now);
    const check = checkExtension(price, session.extensions_used, balance.available);
    if (!check.ok) throw new NowError(409, check.reason, "More time is no longer possible.");
    const step = session.extensions_used + 1;
    await postTransfers([sessionHold(session.student_id, request.id, check.coins, step)], { client, now });
    const base = Math.max(session.ends_at.getTime(), now.getTime());
    const endsAt = new Date(base + check.minutes * 60_000);
    await client.query(
      `UPDATE now.sessions SET extensions_used = $2, ends_at = $3, extension_requested_at = NULL WHERE id = $1`,
      [session.id, step, endsAt],
    );
    await client.query(`UPDATE now.requests SET held_coins = held_coins + $2, updated_at = NOW() WHERE id = $1`, [
      request.id,
      check.coins,
    ]);
    await logEvent(client, {
      type: "extension.confirmed",
      requestId: request.id,
      sessionId: session.id,
      actor: "bot" in actor ? "bot" : session.helper_id,
      payload: { step, coins: check.coins, endsAt: endsAt.toISOString() },
    });
    endsAtOut = endsAt.toISOString();
    effects.push(() =>
      publishNowEvent(requestStreamId(request.id), { type: "extended", sessionId: session.id, endsAt: endsAt.toISOString(), step }),
    );
    if (session.solver_kind === "human") {
      effects.push(() =>
        publishNowEvent(helperStreamId(session.helper_id), { type: "extended", sessionId: session.id, endsAt: endsAt.toISOString() }),
      );
    }
    scheduleSessionTimers(effects, session.id, endsAt, now);
  });
  await runEffects(effects);
  return { sessionId, pending: false, endsAt: endsAtOut };
}

// ---------------------------------------------------------------------------
// Timers, sweep, nightly.

export async function handleNowTimer(timer: NowTimer, now: Date = new Date()): Promise<string> {
  switch (timer.kind) {
    case "offer_expired":
      return (await expireOffer(timer.offerId, now)) ? "expired" : "noop";
    case "dispatch": {
      const decision = await dispatchRequest(timer.requestId, now);
      return decision?.action ?? "noop";
    }
    case "no_show":
      return (await handleNoShow(timer.sessionId, now)) ?? "noop";
    case "session_warn": {
      const res = await (await db()).query<{ request_id: string; ends_at: Date | null; ended_at: Date | null }>(
        `SELECT request_id, ends_at, ended_at FROM now.sessions WHERE id = $1`,
        [timer.sessionId],
      );
      const row = res.rows[0];
      if (!row || row.ended_at || !row.ends_at) return "noop";
      await publishNowEvent(requestStreamId(row.request_id), {
        type: "ending_soon",
        sessionId: timer.sessionId,
        endsAt: row.ends_at.toISOString(),
      });
      return "warned";
    }
    case "session_end":
      await endSession({ system: "timer" }, timer.sessionId, {}, now);
      return "ended";
  }
}

const SWEEP_BATCH = 50;

/**
 * One failing item must not stop the sweep: rows are ordered oldest first, so
 * a request that always throws would otherwise block everything behind it.
 */
async function safely<T>(what: string, id: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error(`[origin-now] sweep ${what} failed`, id, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Every minute: re-does anything a missed or late QStash timer left behind. */
export async function runNowSweep(now: Date = new Date()) {
  const pool = await db();
  const counts = { offersExpired: 0, dispatched: 0, noShows: 0, ended: 0, settled: 0 };

  const offers = await pool.query<{ id: string }>(
    `SELECT id FROM now.offers WHERE response IS NULL AND expires_at <= $1 ORDER BY expires_at LIMIT ${SWEEP_BATCH}`,
    [now],
  );
  for (const { id } of offers.rows) if (await safely("expire offer", id, () => expireOffer(id, now))) counts.offersExpired += 1;

  const waiting = await pool.query<{ id: string }>(
    `SELECT id FROM now.requests WHERE status = 'requested' AND updated_at <= $1 ORDER BY created_at LIMIT ${SWEEP_BATCH}`,
    [new Date(now.getTime() - 15_000)],
  );
  for (const { id } of waiting.rows) if (await safely("dispatch", id, () => dispatchRequest(id, now))) counts.dispatched += 1;

  const unjoined = await pool.query<{ id: string }>(
    `SELECT s.id FROM now.sessions s JOIN now.requests r ON r.id = s.request_id
      WHERE s.ended_at IS NULL AND r.status = 'accepted' AND s.accepted_at <= $1 LIMIT ${SWEEP_BATCH}`,
    [new Date(now.getTime() - NO_SHOW_WINDOW_MS)],
  );
  for (const { id } of unjoined.rows) if (await safely("no-show", id, () => handleNoShow(id, now))) counts.noShows += 1;

  const overrun = await pool.query<{ id: string }>(
    `SELECT id FROM now.sessions WHERE ended_at IS NULL AND ends_at IS NOT NULL AND ends_at <= $1 LIMIT ${SWEEP_BATCH}`,
    [new Date(now.getTime() - OVERRUN_GRACE_MS)],
  );
  for (const { id } of overrun.rows) {
    if (await safely("end", id, () => endSession({ system: "timer" }, id, {}, now).then(() => true))) counts.ended += 1;
  }

  // Ended sessions still waiting to settle: bots immediately, humans once the
  // outcome window has passed without an outcome (then the coins go back).
  const unsettled = await pool.query<{ id: string }>(
    `SELECT id FROM now.sessions
      WHERE ended_at IS NOT NULL AND settled_at IS NULL AND (solver_kind = 'bot' OR outcome IS NOT NULL OR ended_at <= $1)
      LIMIT ${SWEEP_BATCH}`,
    [new Date(now.getTime() - RATING_WINDOW_MS)],
  );
  for (const { id } of unsettled.rows) if (await safely("settle", id, () => settleSession(id, now))) counts.settled += 1;

  return counts;
}

export async function settleSession(sessionId: string, now: Date = new Date()): Promise<boolean> {
  const effects: Effect[] = [];
  let done = false;
  await withNowTransaction(async (client) => {
    const locked = await lockSession(client, sessionId);
    if (!locked || !locked.session.ended_at || locked.session.settled_at) return;
    // Same readiness as the sweep: a human session waits for the solver's
    // outcome until the window passes (a dismissed report must not cut that short).
    const s = locked.session;
    const ready = s.solver_kind === "bot" || s.outcome !== null || s.ended_at!.getTime() <= now.getTime() - RATING_WINDOW_MS;
    if (!ready) return;
    done = (await settleLocked(client, locked.session, locked.request, now, effects)) === "settled";
  });
  await runEffects(effects);
  return done;
}

/** Daily: closes rating windows, audits the ledger, purges old recordings. */
export async function runNowNightly(now: Date = new Date()) {
  const pool = await db();
  const due = await pool.query<{ id: string }>(
    // The LAST session's end: a request requeued after a solver no-show also
    // has an older, ended session that must not close the window early.
    `SELECT r.id FROM now.requests r
      WHERE r.status = 'ended'
        AND (SELECT max(s.ended_at) FROM now.sessions s WHERE s.request_id = r.id) <= $1`,
    [new Date(now.getTime() - RATING_WINDOW_MS)],
  );
  let ratingWindowsClosed = 0;
  for (const { id } of due.rows) {
    await safely("close rating window", id, () =>
      withNowTransaction(async (client) => {
        const request = await lockRequest(client, id);
        if (!request || request.status !== "ended") return;
        await applyTransition(client, request, "rating_window_closed");
        await logEvent(client, { type: "request.unrated", requestId: id, actor: "system" });
        ratingWindowsClosed += 1;
      }),
    );
  }

  // Pilot evening bonus (B84): before the audit, so its transfers are checked too.
  let eveningBonus: EveningBonusRun | null = null;
  try {
    eveningBonus = await payEveningBonuses(now);
  } catch (error) {
    console.error("[origin-now] evening bonus failed", error instanceof Error ? error.message : error);
  }

  const legs = await loadAllLegsForAudit();
  const unbalanced = findUnbalancedTransfers(legs);
  if (unbalanced.length > 0) {
    console.error("[origin-now] ledger audit found unbalanced transfers", unbalanced.slice(0, 20));
    await pool.query(`INSERT INTO now.events (type, actor, payload) VALUES ('ledger.unbalanced', 'system', $1::jsonb)`, [
      JSON.stringify({ count: unbalanced.length, sample: unbalanced.slice(0, 20) }),
    ]);
  }
  await pool.query(`DELETE FROM now.presence_minutes WHERE minute < $1`, [new Date(now.getTime() - 90 * 24 * 60 * 60_000)]);
  const recordings = await purgeExpiredRecordings(now);
  // Merch delivery addresses, 90 days after delivery or cancellation (B91).
  const addressesWiped = await purgeOldDeliveryAddresses(now).catch((error) => {
    console.error("[origin-now] address purge failed", error instanceof Error ? error.message : error);
    return 0;
  });
  return {
    ratingWindowsClosed,
    unbalancedTransfers: unbalanced.length,
    recordingsDeleted: recordings.deleted,
    recordingDeletesFailed: recordings.failed,
    addressesWiped,
    eveningBonus,
  };
}
