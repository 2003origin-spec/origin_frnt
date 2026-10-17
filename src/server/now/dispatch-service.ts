/**
 * Origin NOW requests, dispatch and offers (build step 5; plan doc,
 * "Matching and dispatch rules").
 *
 * Every state change:
 *   - runs in one transaction holding the request row lock (FOR UPDATE),
 *   - goes through session-state.transition() — nothing else sets `status`,
 *   - writes its instrumentation event to now.events in that transaction,
 *   - queues side effects (stream events, timers, push) that run only AFTER
 *     commit, so a rolled-back change never notifies anyone.
 *
 * The accept race is settled by a conditional UPDATE in Postgres; Redis is not
 * on the correctness path (plan decision B18).
 */

import type { PoolClient } from "pg";

import { getOgcodeCatalogQuestionById } from "@/server/ogcode-catalog";
import { getOgcodeQuestionProgress, isOgcodeProgressAvailable } from "@/server/ogcode-progress";
import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { loadPriceTable } from "./admin-store";
import { PLATFORM_ACCOUNTS, sessionHold, sessionRelease, userAccount, type Transfer } from "./ledger-rules";
import { getWalletBalance, InsufficientCoinsError, postTransfers, withNowTransaction } from "./ledger-store";
import {
  botRuleForSubject,
  decideDispatch,
  istDayKey,
  rankCandidates,
  shouldWiden,
  type Candidate,
  type DispatchDecision,
} from "./matching";
import { getNowAccess } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import {
  clearPresence,
  heartbeatPresence,
  helperStreamId,
  listOnlineHelpers,
  publishNowEvent,
  pushOfferToHelper,
  requestStreamId,
  scheduleNowTimer,
} from "./now-realtime";
import { getNowSettings, isWithinOpenHours } from "./now-settings";
import { getLiveKitConfig, getRecordingStorage } from "./livekit";
import { closeRoom } from "./room-service";
import { holdAdjustmentForFallback, lookupPrice } from "./pricing";
import { isNowSubject } from "./solver-rules";
import { BOT_HELPER_ID, ensureBotHelper } from "./solver-service";
import { transition, type RequestEvent } from "./session-state";
import {
  NO_SHOW_WINDOW_MS,
  OFFER_WINDOW_MS,
  STUDENT_DAILY_REQUEST_CAP,
  normalizeDifficulty,
  type ClosedDetail,
  type DeclineReason,
  type Difficulty,
  type RequestStatus,
  type SolverKind,
} from "./types";
import { ensureWelcomeGrant } from "./wallet-service";

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

export type RequestRow = {
  id: string;
  student_id: string;
  question_id: string;
  subject: string;
  chapter: string | null;
  concept: string | null;
  difficulty: Difficulty;
  language: string | null;
  price_coins: number;
  held_coins: number;
  solver_kind: SolverKind | null;
  status: RequestStatus;
  current_offer_id: string | null;
  helper_id: string | null;
  failed_offers: number;
  excluded_helper_ids: string[];
  callback_offered: boolean;
  /** "Ask again": the solver the student asked for first (null = anyone). */
  preferred_helper_id: string | null;
  origin_ai_session_id: string | null;
  ai_explained: boolean;
  context_json: Record<string, unknown>;
  closed_reason: string | null;
  closed_detail: string | null;
  created_at: Date;
  updated_at: Date;
  connected_at: Date | null;
  closed_at: Date | null;
};

export async function lockRequest(client: PoolClient, requestId: string): Promise<RequestRow | null> {
  const res = await client.query<RequestRow>(`SELECT * FROM now.requests WHERE id = $1 FOR UPDATE`, [requestId]);
  return res.rows[0] ?? null;
}

export async function logEvent(
  client: Pick<PoolClient, "query">,
  input: { type: string; requestId?: string | null; sessionId?: string | null; actor?: string | null; payload?: Record<string, unknown> },
): Promise<void> {
  await client.query(
    `INSERT INTO now.events (request_id, session_id, type, actor, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [input.requestId ?? null, input.sessionId ?? null, input.type, input.actor ?? null, JSON.stringify(input.payload ?? {})],
  );
}

/** Applies a state-machine event to a locked request or throws a 409. */
export async function applyTransition(
  client: PoolClient,
  request: RequestRow,
  event: RequestEvent,
  extra: Record<string, unknown> = {},
): Promise<RequestStatus> {
  const result = transition(request.status, event);
  if (!result.ok) throw new NowError(409, "invalid_state", result.error);
  const sets = ["status = $2", "updated_at = NOW()"];
  const values: unknown[] = [request.id, result.to];
  for (const [column, value] of Object.entries(extra)) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  await client.query(`UPDATE now.requests SET ${sets.join(", ")} WHERE id = $1`, values);
  request.status = result.to;
  return result.to;
}

/** Releases whatever is still held for a request back to the student. */
export async function releaseHold(client: PoolClient, request: RequestRow): Promise<void> {
  if (request.held_coins <= 0) return;
  await postTransfers(sessionRelease(request.student_id, request.id, request.held_coins), { client });
  await client.query(`UPDATE now.requests SET held_coins = 0 WHERE id = $1`, [request.id]);
  request.held_coins = 0;
}

// ---------------------------------------------------------------------------
// Create.

export type CreateRequestInput = {
  questionId: string;
  language?: string | null;
  aiExplained?: boolean;
  originAiSessionId?: string | null;
  /** "Ask again": one of the student's own solvers to offer first. */
  preferredHelperId?: string | null;
};

export type MySolver = { helperId: string; name: string; favourite: boolean; online: boolean; lastSessionAt: string | null };

/**
 * "Ask again" (pilot readiness item 2): the solvers a student may ask for
 * first in a subject — verified humans covering the subject whom the student
 * favourited or had a call with, never blocked either way, never their own or
 * a linked account. Favourites first, then most recent; at most 5.
 */
export async function listMySolvers(studentId: string, subject: string, now: Date = new Date()): Promise<MySolver[]> {
  const res = await (await db()).query<{ id: string; display_name: string; favourite: boolean; last_session_at: Date | null }>(
    `SELECT h.id, h.display_name,
            EXISTS (SELECT 1 FROM now.favourites f WHERE f.student_id = $1 AND f.helper_id = h.id) AS favourite,
            (SELECT max(s.ended_at) FROM now.sessions s
              WHERE s.helper_id = h.id AND s.student_id = $1 AND s.started_at IS NOT NULL) AS last_session_at
       FROM now.helpers h
      WHERE h.kind = 'human' AND h.verification_status = 'verified'
        AND h.agreement_version IS NOT NULL AND h.agreement_accepted_at IS NOT NULL
        AND h.user_id <> $1 AND NOT ($1 = ANY(h.linked_user_ids))
        AND EXISTS (SELECT 1 FROM now.helper_expertise e WHERE e.helper_id = h.id AND e.subject = $2)
        AND NOT EXISTS (SELECT 1 FROM now.blocks b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = h.user_id)
                            OR (b.blocker_id = h.user_id AND b.blocked_id = $1))
        AND (EXISTS (SELECT 1 FROM now.favourites f WHERE f.student_id = $1 AND f.helper_id = h.id)
             OR EXISTS (SELECT 1 FROM now.sessions s WHERE s.helper_id = h.id AND s.student_id = $1 AND s.started_at IS NOT NULL))
      ORDER BY favourite DESC, last_session_at DESC NULLS LAST, h.display_name
      LIMIT 5`,
    [studentId, subject],
  );
  const online = await listOnlineHelpers(subject, now.getTime()).catch(() => new Map<string, number>());
  return res.rows.map((r) => ({
    helperId: r.id,
    name: r.display_name,
    favourite: r.favourite,
    online: online.has(r.id),
    lastSessionAt: r.last_session_at ? r.last_session_at.toISOString() : null,
  }));
}

function istDayStart(now: Date): Date {
  return new Date(`${istDayKey(now.getTime())}T00:00:00+05:30`);
}

export async function createRequest(studentId: string, input: CreateRequestInput, now: Date = new Date()): Promise<RequestView> {
  const access = await getNowAccess(studentId, now);
  if (!access.canRequest) {
    throw new NowError(
      403,
      access.blockedReason ?? "not_invited",
      access.blockedReason === "suspended"
        ? "Live help is paused on this account after a report review."
        : "Origin NOW is not open for this account yet.",
    );
  }
  await ensureWelcomeGrant(studentId);

  const question = await getOgcodeCatalogQuestionById(input.questionId);
  if (!question) throw new NowError(404, "question_not_found", "Question not found.");
  const subject = String(question.subject ?? "").trim().toLowerCase();
  const difficulty = normalizeDifficulty(question.difficulty);
  if (!isNowSubject(subject) || !difficulty) {
    throw new NowError(400, "question_not_supported", "Live help is not available for this question.");
  }
  // Plan doc, matching step 8: only after an attempt, so the button is never an answer key.
  if (!isOgcodeProgressAvailable()) throw new NowError(503, "progress_unavailable", "Please try again in a moment.");
  const progress = await getOgcodeQuestionProgress(studentId, input.questionId);
  if (!progress.attempted && progress.totalAttempts === 0 && !progress.answerRevealed) {
    throw new NowError(409, "attempt_first", "Try the question first, then ask for live help.");
  }

  const today = await (await db()).query<{ n: number }>(
    `SELECT count(*)::int AS n FROM now.requests WHERE student_id = $1 AND created_at >= $2 AND status <> 'no_helper'`,
    [studentId, istDayStart(now)],
  );
  if ((today.rows[0]?.n ?? 0) >= STUDENT_DAILY_REQUEST_CAP) {
    throw new NowError(429, "daily_cap", `You can ask for live help ${STUDENT_DAILY_REQUEST_CAP} times a day during the pilot.`);
  }

  const { rows: prices } = await loadPriceTable();
  const price = lookupPrice(prices, difficulty, "human");
  if (!price) throw new NowError(503, "no_price", "Live help is not priced yet.");

  const preferredHelperId = input.preferredHelperId?.trim() || null;
  if (preferredHelperId && !(await listMySolvers(studentId, subject, now)).some((m) => m.helperId === preferredHelperId)) {
    throw new NowError(400, "preferred_not_available", "That solver cannot be asked for this subject. Choose another or ask anyone.");
  }

  const requestId = createPrefixedId("nreq");
  const language = input.language?.trim().toLowerCase().slice(0, 30) || null;
  try {
    await withNowTransaction(async (client) => {
      await client.query(
        `INSERT INTO now.requests
           (id, student_id, question_id, subject, chapter, concept, difficulty, language, price_coins, held_coins,
            origin_ai_session_id, ai_explained, context_json, created_at, updated_at, preferred_helper_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12::jsonb, $13, $13, $14)`,
        [
          requestId,
          studentId,
          input.questionId,
          subject,
          question.chapter ?? null,
          question.concept ?? null,
          difficulty,
          language,
          price.priceCoins,
          input.originAiSessionId ?? null,
          Boolean(input.aiExplained),
          JSON.stringify({
            question: { text: question.text, options: question.options ?? [], image: question.image ?? null },
          }),
          now,
          preferredHelperId,
        ],
      );
      await postTransfers([sessionHold(studentId, requestId, price.priceCoins)], { client, now });
      await logEvent(client, {
        type: "request.created",
        requestId,
        actor: studentId,
        payload: { subject, chapter: question.chapter, difficulty, priceCoins: price.priceCoins, language, preferredHelperId },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new NowError(409, "open_request_exists", "You already have a live help request open.");
    }
    throw error;
  }
  // The request and its hold are committed: a dispatch hiccup (Redis, LiveKit)
  // must not turn into an error for the student. The sweep retries within a minute.
  await dispatchSafely(requestId, now, "create");
  return getRequestView(requestId, { viewerUserId: studentId });
}

/** Dispatch after a committed change; failures are logged and left to the sweep. */
export async function dispatchSafely(requestId: string, now: Date, why: string): Promise<void> {
  try {
    await dispatchRequest(requestId, now);
  } catch (error) {
    console.error(`[origin-now] dispatch after ${why} failed`, requestId, error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// Dispatch.

async function loadCandidates(
  client: PoolClient,
  request: RequestRow,
  onlineIds: string[],
  now: Date,
): Promise<{ candidates: Candidate[]; humansOnline: number }> {
  if (onlineIds.length === 0) return { candidates: [], humansOnline: 0 };
  const dayStart = istDayStart(now);
  const res = await client.query<{
    id: string;
    user_id: string;
    verified: boolean;
    agreement_ok: boolean;
    languages: string[];
    linked_user_ids: string[];
    covers_chapter: boolean;
    in_live: boolean;
    blocked: boolean;
    already_offered: boolean;
    with_student_today: number;
    rating_avg: number | null;
    accept_rate: number | null;
    median_accept_ms: number | null;
    sessions_today: number;
    is_favourite: boolean;
    last_used_at: Date | null;
  }>(
    `SELECT h.id, h.user_id,
            h.verification_status = 'verified' AS verified,
            (h.agreement_version IS NOT NULL AND h.agreement_accepted_at IS NOT NULL) AS agreement_ok,
            h.languages, h.linked_user_ids,
            EXISTS (SELECT 1 FROM now.helper_expertise e
                     WHERE e.helper_id = h.id AND e.subject = $2
                       AND (e.chapter = '' OR lower(e.chapter) = lower(COALESCE($3, '')))) AS covers_chapter,
            (EXISTS (SELECT 1 FROM now.sessions s WHERE s.helper_id = h.id AND s.ended_at IS NULL)
              OR EXISTS (SELECT 1 FROM now.offers o2 WHERE o2.helper_id = h.id AND o2.response IS NULL
                          AND o2.expires_at > $7 AND o2.request_id <> $5)) AS in_live,
            EXISTS (SELECT 1 FROM now.blocks b
                     WHERE (b.blocker_id = $4 AND b.blocked_id = h.user_id)
                        OR (b.blocker_id = h.user_id AND b.blocked_id = $4)) AS blocked,
            EXISTS (SELECT 1 FROM now.offers o WHERE o.request_id = $5 AND o.helper_id = h.id) AS already_offered,
            (SELECT count(*)::int FROM now.sessions s
              WHERE s.helper_id = h.id AND s.student_id = $4 AND s.started_at IS NOT NULL AND s.accepted_at >= $6) AS with_student_today,
            (SELECT avg(stars)::float FROM (SELECT stars FROM now.ratings r
               WHERE r.helper_id = h.id AND r.counted AND NOT r.held_until_case_closes
               ORDER BY r.created_at DESC LIMIT 30) t) AS rating_avg,
            (SELECT CASE WHEN count(*) = 0 THEN NULL
                         ELSE (count(*) FILTER (WHERE response = 'accepted'))::float / count(*) END
               FROM (SELECT response FROM now.offers o WHERE o.helper_id = h.id AND o.response IS NOT NULL
                      ORDER BY o.offered_at DESC LIMIT 30) t) AS accept_rate,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (responded_at - offered_at)) * 1000)
               FROM (SELECT responded_at, offered_at FROM now.offers o
                      WHERE o.helper_id = h.id AND o.response = 'accepted'
                      ORDER BY o.offered_at DESC LIMIT 30) t) AS median_accept_ms,
            (SELECT count(*)::int FROM now.sessions s WHERE s.helper_id = h.id AND s.accepted_at >= $6) AS sessions_today,
            EXISTS (SELECT 1 FROM now.favourites f WHERE f.student_id = $4 AND f.helper_id = h.id) AS is_favourite,
            (SELECT max(s.ended_at) FROM now.sessions s
              WHERE s.helper_id = h.id AND s.student_id = $4 AND s.started_at IS NOT NULL) AS last_used_at
       FROM now.helpers h
      WHERE h.id = ANY($1::text[]) AND h.kind = 'human'
        AND EXISTS (SELECT 1 FROM now.helper_expertise e WHERE e.helper_id = h.id AND e.subject = $2)`,
    [onlineIds, request.subject, request.chapter, request.student_id, request.id, dayStart, now],
  );
  const lastSeen = await listOnlineHelpers(request.subject, now.getTime());
  // "Online" for the bot rule means someone who could ever take THIS request:
  // a blocked, excluded (no-show) or own/linked solver never will, so they must
  // not make the student wait for a human (busy ones might free up, so they count).
  const humansOnline = res.rows.filter(
    (r) =>
      r.verified &&
      r.agreement_ok &&
      !r.blocked &&
      !request.excluded_helper_ids.includes(r.id) &&
      r.user_id !== request.student_id &&
      !r.linked_user_ids.includes(request.student_id),
  ).length;
  const candidates = res.rows.map<Candidate>((r) => ({
    helperId: r.id,
    userId: r.user_id,
    verified: r.verified,
    agreementAccepted: r.agreement_ok,
    lastSeenMs: lastSeen.get(r.id) ?? 0,
    inLiveSession: r.in_live,
    blockedByStudent: r.blocked,
    excludedForRequest: request.excluded_helper_ids.includes(r.id),
    alreadyOffered: r.already_offered,
    linkedUserIds: r.linked_user_ids,
    sessionsWithStudentToday: r.with_student_today,
    coversChapter: r.covers_chapter,
    languages: r.languages,
    ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
    acceptRate: r.accept_rate === null ? null : Number(r.accept_rate),
    medianAcceptMs: r.median_accept_ms === null ? null : Number(r.median_accept_ms),
    sessionsToday: r.sessions_today,
    isFavourite: r.is_favourite,
    isPreferred: r.id === request.preferred_helper_id,
    lastUsedByStudentAt: r.last_used_at ? r.last_used_at.getTime() : null,
  }));
  return { candidates, humansOnline };
}

export type SessionRowLite = { id: string; livekit_room: string };

/** Inserts the session for an accepted request (human or bot). */
export async function openSession(
  client: PoolClient,
  request: RequestRow,
  helperId: string,
  solverKind: SolverKind,
  now: Date,
): Promise<SessionRowLite> {
  const sessionId = createPrefixedId("nses");
  const room = `now-${sessionId}`;
  await client.query(
    `INSERT INTO now.sessions (id, request_id, helper_id, student_id, solver_kind, livekit_room, accepted_at, helper_joined_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    // Nobody counts as joined yet, the bot included: joinSession checks LiveKit for its agent.
    [sessionId, request.id, helperId, request.student_id, solverKind, room, now, null],
  );
  return { id: sessionId, livekit_room: room };
}

/**
 * Decides and performs the next dispatch step for a waiting request.
 * Safe to call any number of times: it no-ops unless the request is in
 * `requested` (an outstanding offer is resolved by accept/decline/expiry).
 */
export async function dispatchRequest(requestId: string, now: Date = new Date()): Promise<DispatchDecision | null> {
  const settings = await getNowSettings();
  const { rows: prices } = await loadPriceTable();
  const effects: Effect[] = [];
  let decision: DispatchDecision | null = null;
  let botUnaffordable = false;

  const peek = await (await db()).query<RequestRow>(`SELECT * FROM now.requests WHERE id = $1`, [requestId]);
  const snapshot = peek.rows[0];
  if (!snapshot || snapshot.status !== "requested") return null;
  const online = await listOnlineHelpers(snapshot.subject, now.getTime());
  if (botRuleForSubject(settings.bot, snapshot.subject).enabled) await ensureBotHelper();

  try {
    await withNowTransaction(async (client) => {
      const request = await lockRequest(client, requestId);
      if (!request || request.status !== "requested") return;
      const widened = shouldWiden(request.failed_offers);
      const { candidates, humansOnline } = await loadCandidates(client, request, [...online.keys()], now);
      const ranked = rankCandidates(candidates, {
        studentId: request.student_id,
        nowMs: now.getTime(),
        language: request.language,
        widened,
      });
      decision = decideDispatch(
        {
          inHumanHours: isWithinOpenHours(settings.openHours, now),
          eligibleHumans: ranked.length,
          humansOnline,
          failedOffers: request.failed_offers,
          waitedMs: now.getTime() - request.created_at.getTime(),
          callbackOffered: request.callback_offered,
        },
        botRuleForSubject(settings.bot, request.subject),
      );

      switch (decision.action) {
        case "offer_human": {
          const helper = ranked[0];
          const offerId = createPrefixedId("noff");
          const expiresAt = new Date(now.getTime() + OFFER_WINDOW_MS);
          const rank = request.failed_offers + 1;
          await client.query(
            `INSERT INTO now.offers (id, request_id, helper_id, rank, offered_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [offerId, request.id, helper.helperId, rank, now, expiresAt],
          );
          await applyTransition(client, request, "offer_sent", { current_offer_id: offerId });
          await logEvent(client, {
            type: "offer.sent",
            requestId: request.id,
            actor: "system",
            payload: { offerId, helperId: helper.helperId, rank, widened },
          });
          const card = offerCard(request);
          effects.push(
            () =>
              publishNowEvent(helperStreamId(helper.helperId), {
                type: "offer",
                offerId,
                requestId: request.id,
                expiresAt: expiresAt.toISOString(),
                card,
              }),
            () => publishNowEvent(requestStreamId(request.id), { type: "status", status: "offered" }),
            () => pushOfferToHelper(helper.userId, { offerId, expiresAt: expiresAt.toISOString(), subject: request.subject }),
            async () => {
              await scheduleNowTimer({ kind: "offer_expired", offerId }, OFFER_WINDOW_MS / 1000 + 1);
            },
          );
          return;
        }
        case "assign_bot": {
          if (request.excluded_helper_ids.includes(BOT_HELPER_ID)) {
            // The bot already failed to arrive for this request: close and refund, never loop.
            decision = { action: "close_no_helper", detail: "none_online" };
            await closeNoHelper(client, request, "none_online", effects);
            return;
          }
          const botPrice = lookupPrice(prices, request.difficulty, "bot");
          if (!botPrice) throw new NowError(503, "no_price", "Bot price is not configured.");
          const delta = holdAdjustmentForFallback(request.held_coins, botPrice.priceCoins);
          if (delta > 0) {
            const balance = await getWalletBalance(request.student_id, now);
            if (balance.available < delta) {
              botUnaffordable = true;
              throw new InsufficientCoinsError(balance.available, delta);
            }
            await postTransfers(
              [
                {
                  kind: "session_hold",
                  from: userAccount(request.student_id),
                  to: PLATFORM_ACCOUNTS.escrow,
                  amount: delta,
                  requestId: request.id,
                  idempotencyKey: `hold:${request.id}:bot`,
                } satisfies Transfer,
              ],
              { client, now },
            );
          } else if (delta < 0) {
            await postTransfers(
              [
                {
                  kind: "session_release",
                  from: PLATFORM_ACCOUNTS.escrow,
                  to: userAccount(request.student_id),
                  amount: -delta,
                  requestId: request.id,
                  idempotencyKey: `release:${request.id}:bot`,
                } satisfies Transfer,
              ],
              { client, now },
            );
          }
          await applyTransition(client, request, "bot_assigned", {
            helper_id: BOT_HELPER_ID,
            solver_kind: "bot",
            held_coins: botPrice.priceCoins,
            price_coins: botPrice.priceCoins,
          });
          const session = await openSession(client, request, BOT_HELPER_ID, "bot", now);
          await logEvent(client, {
            type: "bot.fallback",
            requestId: request.id,
            sessionId: session.id,
            actor: "system",
            payload: { reason: decision.reason, priceCoins: botPrice.priceCoins },
          });
          effects.push(
            () =>
              publishNowEvent(requestStreamId(request.id), {
                type: "accepted",
                sessionId: session.id,
                solver: { kind: "bot", displayName: "Origin" },
              }),
            async () => {
              await scheduleNowTimer({ kind: "no_show", sessionId: session.id }, NO_SHOW_WINDOW_MS / 1000 + 5);
            },
            async () => {
              // Imported lazily: bot-service builds on this module.
              const { dispatchBotToSession } = await import("./bot-service");
              await dispatchBotToSession(session.id);
            },
          );
          return;
        }
        case "close_no_helper":
          await closeNoHelper(client, request, decision.detail, effects);
          return;
        case "offer_callback":
          await client.query(`UPDATE now.requests SET callback_offered = TRUE, updated_at = NOW() WHERE id = $1`, [request.id]);
          await logEvent(client, { type: "request.callback_offered", requestId: request.id, actor: "system" });
          effects.push(() => publishNowEvent(requestStreamId(request.id), { type: "callback_offered" }));
          return;
        case "wait":
          effects.push(async () => {
            await scheduleNowTimer({ kind: "dispatch", requestId: request.id }, 20);
          });
          return;
      }
    });
  } catch (error) {
    if (botUnaffordable) {
      // The bot costs more than this student can cover: close and refund.
      await withNowTransaction(async (client) => {
        const request = await lockRequest(client, requestId);
        if (request && request.status === "requested") await closeNoHelper(client, request, "none_online", effects);
      });
      decision = { action: "close_no_helper", detail: "none_online" };
    } else {
      throw error;
    }
  }
  await runEffects(effects);
  return decision;
}

async function closeNoHelper(client: PoolClient, request: RequestRow, detail: ClosedDetail, effects: Effect[]): Promise<void> {
  await applyTransition(client, request, "give_up", {
    closed_reason: "no_helper",
    closed_detail: detail,
    closed_at: new Date(),
    current_offer_id: null,
  });
  await releaseHold(client, request);
  await logEvent(client, {
    type: "request.closed",
    requestId: request.id,
    actor: "system",
    payload: { reason: "no_helper", detail },
  });
  effects.push(() => publishNowEvent(requestStreamId(request.id), { type: "closed", reason: "no_helper", detail }));
}

function offerCard(request: RequestRow) {
  const question = (request.context_json.question ?? {}) as { text?: string; options?: string[]; image?: string | null };
  return {
    subject: request.subject,
    chapter: request.chapter,
    concept: request.concept,
    difficulty: request.difficulty,
    priceCoins: request.price_coins,
    language: request.language,
    aiExplained: request.ai_explained,
    question: { text: question.text ?? "", options: question.options ?? [], image: question.image ?? null },
  };
}

// ---------------------------------------------------------------------------
// Offers.

type OfferRow = {
  id: string;
  request_id: string;
  helper_id: string;
  offered_at: Date;
  expires_at: Date;
  response: string | null;
};

export async function getHelperByUserId(userId: string): Promise<{ id: string; verification_status: string } | null> {
  const res = await (await db()).query<{ id: string; verification_status: string }>(
    `SELECT id, verification_status FROM now.helpers WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

async function requireHelper(userId: string) {
  const helper = await getHelperByUserId(userId);
  if (!helper) throw new NowError(403, "not_a_solver", "Only approved solvers can do this.");
  return helper;
}

/** The open offer for this helper, if any (called on push tap and every stream reconnect). */
export async function getCurrentOffer(helperUserId: string, now: Date = new Date()) {
  const helper = await requireHelper(helperUserId);
  const res = await (await db()).query<OfferRow & { request: RequestRow }>(
    `SELECT o.*, row_to_json(r.*) AS request FROM now.offers o JOIN now.requests r ON r.id = o.request_id
      WHERE o.helper_id = $1 AND o.response IS NULL AND o.expires_at > $2
      ORDER BY o.offered_at DESC LIMIT 1`,
    [helper.id, now],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    offerId: row.id,
    requestId: row.request_id,
    expiresAt: row.expires_at.toISOString(),
    card: offerCard({ ...row.request, context_json: row.request.context_json ?? {} } as RequestRow),
  };
}

/** A small grace so an accept that left the phone just before expiry still counts. */
const ACCEPT_GRACE_MS = 2_000;

export async function respondToOffer(
  helperUserId: string,
  offerId: string,
  action: "accept" | "decline",
  reason: DeclineReason | null,
  now: Date = new Date(),
): Promise<{ accepted: boolean; sessionId: string | null }> {
  const helper = await requireHelper(helperUserId);
  if (helper.verification_status !== "verified") throw new NowError(403, "restricted", "Your solver account is on hold.");
  const effects: Effect[] = [];
  let outcome: { accepted: boolean; sessionId: string | null } = { accepted: false, sessionId: null };
  let redispatch: string | null = null;

  await withNowTransaction(async (client) => {
    const offerRes = await client.query<OfferRow>(`SELECT * FROM now.offers WHERE id = $1`, [offerId]);
    const offer = offerRes.rows[0];
    if (!offer || offer.helper_id !== helper.id) throw new NowError(404, "not_found", "Offer not found.");
    const request = await lockRequest(client, offer.request_id);
    if (!request) throw new NowError(404, "not_found", "Request not found.");
    const stillOpen =
      offer.response === null && request.status === "offered" && request.current_offer_id === offer.id;

    if (action === "decline") {
      if (!stillOpen) return;
      await client.query(
        `UPDATE now.offers SET response = 'declined', decline_reason = $2, responded_at = $3 WHERE id = $1 AND response IS NULL`,
        [offer.id, reason ?? "other", now],
      );
      await applyTransition(client, request, "offer_declined", {
        current_offer_id: null,
        failed_offers: request.failed_offers + 1,
      });
      await logEvent(client, {
        type: "offer.declined",
        requestId: request.id,
        actor: helper.id,
        payload: { offerId, reason: reason ?? "other" },
      });
      redispatch = request.id;
      return;
    }

    if (!stillOpen || offer.expires_at.getTime() + ACCEPT_GRACE_MS < now.getTime()) {
      throw new NowError(409, "already_taken", "This doubt was already taken or the offer expired.");
    }
    // The race is decided here: exactly one conditional update can win.
    const won = await client.query(
      `UPDATE now.requests SET status = 'accepted', helper_id = $2, solver_kind = 'human', updated_at = NOW()
        WHERE id = $1 AND status = 'offered' AND current_offer_id = $3`,
      [request.id, helper.id, offer.id],
    );
    if (won.rowCount !== 1) throw new NowError(409, "already_taken", "This doubt was already taken.");
    const busy = await client.query(`SELECT 1 FROM now.sessions WHERE helper_id = $1 AND ended_at IS NULL LIMIT 1`, [helper.id]);
    if ((busy.rowCount ?? 0) > 0) {
      // Rolls the whole accept back: the offer stays open for its window and then moves on.
      throw new NowError(409, "already_in_session", "Finish your current session before accepting another doubt.");
    }
    request.status = "accepted";
    await client.query(`UPDATE now.offers SET response = 'accepted', responded_at = $2 WHERE id = $1`, [offer.id, now]);
    const session = await openSession(client, request, helper.id, "human", now);
    await logEvent(client, {
      type: "offer.accepted",
      requestId: request.id,
      sessionId: session.id,
      actor: helper.id,
      payload: { offerId, acceptMs: now.getTime() - offer.offered_at.getTime() },
    });
    outcome = { accepted: true, sessionId: session.id };
    const display = await client.query<{ display_name: string }>(`SELECT display_name FROM now.helpers WHERE id = $1`, [helper.id]);
    effects.push(
      () =>
        publishNowEvent(requestStreamId(request.id), {
          type: "accepted",
          sessionId: session.id,
          solver: { kind: "human", helperId: helper.id, displayName: display.rows[0]?.display_name ?? "Solver" },
        }),
      () => publishNowEvent(helperStreamId(helper.id), { type: "offer_closed", offerId, accepted: true }),
      async () => {
        await scheduleNowTimer({ kind: "no_show", sessionId: session.id }, NO_SHOW_WINDOW_MS / 1000 + 5);
      },
    );
  });

  await runEffects(effects);
  if (redispatch) await dispatchSafely(redispatch, now, "decline");
  return outcome;
}

/** Offer timer / sweep: expires an offer only once its deadline has truly passed. */
export async function expireOffer(offerId: string, now: Date = new Date()): Promise<boolean> {
  let requestId: string | null = null;
  let helperId: string | null = null;
  await withNowTransaction(async (client) => {
    const offerRes = await client.query<OfferRow>(`SELECT * FROM now.offers WHERE id = $1`, [offerId]);
    const offer = offerRes.rows[0];
    if (!offer || offer.response !== null || offer.expires_at.getTime() > now.getTime()) return;
    const request = await lockRequest(client, offer.request_id);
    const updated = await client.query(
      `UPDATE now.offers SET response = 'expired', responded_at = $2 WHERE id = $1 AND response IS NULL`,
      [offer.id, now],
    );
    if (updated.rowCount !== 1) return;
    helperId = offer.helper_id;
    if (request && request.status === "offered" && request.current_offer_id === offer.id) {
      await applyTransition(client, request, "offer_expired", {
        current_offer_id: null,
        failed_offers: request.failed_offers + 1,
      });
      await logEvent(client, { type: "offer.expired", requestId: request.id, actor: "system", payload: { offerId } });
      requestId = request.id;
    }
  });
  if (helperId) await publishNowEvent(helperStreamId(helperId), { type: "offer_closed", offerId, accepted: false });
  if (requestId) await dispatchSafely(requestId, now, "offer expiry");
  return requestId !== null;
}

// ---------------------------------------------------------------------------
// Cancel + read.

export async function cancelRequest(studentId: string, requestId: string, now: Date = new Date()): Promise<RequestView> {
  const effects: Effect[] = [];
  await withNowTransaction(async (client) => {
    const request = await lockRequest(client, requestId);
    if (!request || request.student_id !== studentId) throw new NowError(404, "not_found", "Request not found.");
    if (request.status === "cancelled") return;
    if (!["requested", "offered", "accepted"].includes(request.status)) {
      throw new NowError(409, "cannot_cancel", "This request can no longer be cancelled; end the session instead.");
    }
    if (request.current_offer_id) {
      const closed = await client.query<{ helper_id: string }>(
        `UPDATE now.offers SET response = 'expired', responded_at = $2 WHERE id = $1 AND response IS NULL RETURNING helper_id`,
        [request.current_offer_id, now],
      );
      const offerId = request.current_offer_id;
      for (const { helper_id } of closed.rows) {
        effects.push(() => publishNowEvent(helperStreamId(helper_id), { type: "offer_closed", offerId, accepted: false }));
      }
    }
    const closedSessions = await client.query<{ id: string }>(
      `UPDATE now.sessions SET ended_at = $2, ended_by = 'student', payable = FALSE, settled_at = $2
        WHERE request_id = $1 AND ended_at IS NULL RETURNING id`,
      [request.id, now],
    );
    for (const { id } of closedSessions.rows) effects.push(() => closeRoom(id));
    await applyTransition(client, request, "student_cancelled", {
      closed_reason: "cancelled",
      closed_at: now,
      current_offer_id: null,
    });
    await releaseHold(client, request);
    await logEvent(client, { type: "request.closed", requestId: request.id, actor: studentId, payload: { reason: "cancelled" } });
    effects.push(() => publishNowEvent(requestStreamId(request.id), { type: "closed", reason: "cancelled" }));
    if (request.helper_id && request.helper_id !== BOT_HELPER_ID) {
      const helperId = request.helper_id;
      effects.push(() => publishNowEvent(helperStreamId(helperId), { type: "request_cancelled", requestId: request.id }));
    }
  });
  await runEffects(effects);
  return getRequestView(requestId, { viewerUserId: studentId });
}

export type RequestView = {
  id: string;
  status: RequestStatus;
  subject: string;
  chapter: string | null;
  difficulty: Difficulty;
  priceCoins: number;
  heldCoins: number;
  createdAt: string;
  closedReason: string | null;
  closedDetail: string | null;
  callbackOffered: boolean;
  /** For the student while their chosen solver ("Ask again") is being asked: that solver's name. */
  askingFirst: string | null;
  session: {
    id: string;
    solverKind: SolverKind;
    solverName: string;
    studentJoined: boolean;
    solverJoined: boolean;
    startedAt: string | null;
    endsAt: string | null;
    endedAt: string | null;
    extensionsUsed: number;
    extensionRequestedAt: string | null;
  } | null;
  /** True when calls are recorded (LiveKit + recording storage configured); the room says so. */
  recorded: boolean;
  /** Only for the assigned solver: the question and the AI context. */
  question: { text: string; options: string[]; image: string | null } | null;
  studentFirstName: string | null;
};

/**
 * Snapshot of a request for its student or its assigned solver. A solver sees
 * the question and the student's first name only; nobody else sees anything.
 */
export async function getRequestView(requestId: string, viewer: { viewerUserId: string }): Promise<RequestView> {
  const res = await (await db()).query<
    RequestRow & {
      student_name: string | null;
      helper_user_id: string | null;
      helper_name: string | null;
      session_id: string | null;
      session_solver_kind: SolverKind | null;
      student_joined_at: Date | null;
      helper_joined_at: Date | null;
      started_at: Date | null;
      ends_at: Date | null;
      ended_at: Date | null;
      extensions_used: number | null;
      extension_requested_at: Date | null;
      preferred_name: string | null;
      current_offer_helper_id: string | null;
    }
  >(
    `SELECT r.*, u.name AS student_name, h.user_id AS helper_user_id, h.display_name AS helper_name,
            ph.display_name AS preferred_name, co.helper_id AS current_offer_helper_id,
            s.id AS session_id, s.solver_kind AS session_solver_kind, s.student_joined_at, s.helper_joined_at,
            s.started_at, s.ends_at, s.ended_at, s.extensions_used, s.extension_requested_at
       FROM now.requests r
       JOIN origin_users u ON u.id = r.student_id
       LEFT JOIN now.helpers h ON h.id = r.helper_id
       LEFT JOIN now.helpers ph ON ph.id = r.preferred_helper_id
       LEFT JOIN now.offers co ON co.id = r.current_offer_id
       LEFT JOIN LATERAL (SELECT * FROM now.sessions s WHERE s.request_id = r.id ORDER BY s.accepted_at DESC LIMIT 1) s ON TRUE
      WHERE r.id = $1`,
    [requestId],
  );
  const row = res.rows[0];
  const isStudent = row?.student_id === viewer.viewerUserId;
  const isSolver = Boolean(row?.helper_user_id) && row?.helper_user_id === viewer.viewerUserId;
  if (!row || (!isStudent && !isSolver)) throw new NowError(404, "not_found", "Request not found.");
  const question = (row.context_json?.question ?? null) as RequestView["question"];
  return {
    id: row.id,
    status: row.status,
    subject: row.subject,
    chapter: row.chapter,
    difficulty: row.difficulty,
    priceCoins: row.price_coins,
    heldCoins: row.held_coins,
    createdAt: row.created_at.toISOString(),
    closedReason: row.closed_reason,
    closedDetail: row.closed_detail,
    callbackOffered: row.callback_offered,
    askingFirst:
      isStudent && row.status === "offered" && row.preferred_helper_id && row.current_offer_helper_id === row.preferred_helper_id
        ? row.preferred_name
        : null,
    // Back in the queue (a solver no-show): the old, ended session is history, not this request's session.
    session: row.session_id && row.status !== "requested" && row.status !== "offered"
      ? {
          id: row.session_id,
          solverKind: row.session_solver_kind ?? "human",
          solverName: row.helper_name ?? "Solver",
          studentJoined: Boolean(row.student_joined_at),
          solverJoined: Boolean(row.helper_joined_at),
          startedAt: row.started_at ? row.started_at.toISOString() : null,
          endsAt: row.ends_at ? row.ends_at.toISOString() : null,
          endedAt: row.ended_at ? row.ended_at.toISOString() : null,
          extensionsUsed: row.extensions_used ?? 0,
          extensionRequestedAt: row.extension_requested_at ? row.extension_requested_at.toISOString() : null,
        }
      : null,
    recorded: getLiveKitConfig() !== null && getRecordingStorage() !== null,
    question: isSolver || isStudent ? question : null,
    studentFirstName: isSolver ? (row.student_name ?? "").trim().split(/\s+/)[0] || "Student" : null,
  };
}

/** The student's currently open request, if any (to resume after a reload). */
export async function getOpenRequestId(studentId: string): Promise<string | null> {
  const res = await (await db()).query<{ id: string }>(
    `SELECT id FROM now.requests WHERE student_id = $1 AND status IN ('requested', 'offered', 'accepted', 'live')
      ORDER BY created_at DESC LIMIT 1`,
    [studentId],
  );
  return res.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Solver shift: presence heartbeat.

/**
 * Marks a verified solver online for the subjects they asked for (limited to
 * their approved expertise), then nudges waiting requests in those subjects so
 * a solver who just came online is offered them without waiting for the sweep.
 */
export async function heartbeatHelper(
  helperUserId: string,
  requestedSubjects: string[] | null,
  now: Date = new Date(),
): Promise<{ helperId: string; subjects: string[] }> {
  const helper = await requireHelper(helperUserId);
  if (helper.verification_status !== "verified") throw new NowError(403, "restricted", "Your solver account is on hold.");
  const pool = await db();
  const expertise = await pool.query<{ subject: string }>(
    `SELECT DISTINCT subject FROM now.helper_expertise WHERE helper_id = $1`,
    [helper.id],
  );
  const allowed = expertise.rows.map((r) => r.subject);
  const subjects = requestedSubjects === null ? allowed : allowed.filter((s) => requestedSubjects.includes(s));
  await heartbeatPresence(helper.id, subjects, now.getTime());
  if (subjects.length > 0) {
    await pool.query(
      `INSERT INTO now.presence_minutes (helper_id, minute) VALUES ($1, date_trunc('minute', $2::timestamptz)) ON CONFLICT DO NOTHING`,
      [helper.id, now],
    );
    const waiting = await pool.query<{ id: string }>(
      `SELECT id FROM now.requests WHERE status = 'requested' AND subject = ANY($1::text[]) ORDER BY created_at LIMIT 5`,
      [subjects],
    );
    for (const { id } of waiting.rows) {
      try {
        await dispatchRequest(id, now);
      } catch (error) {
        console.warn("[origin-now] heartbeat dispatch failed", id, error instanceof Error ? error.message : error);
      }
    }
  }
  return { helperId: helper.id, subjects };
}

export async function goOffline(helperUserId: string): Promise<void> {
  const helper = await requireHelper(helperUserId);
  await clearPresence(helper.id);
}

// ---------------------------------------------------------------------------
// The "Need human help" button: everything it shows before the student taps.

export type LiveHelpQuote = {
  available: boolean;
  /** Why the button is not offered (null when it is). */
  blockedReason: string | null;
  priceCoins: number | null;
  botPriceCoins: number | null;
  minutes: number | null;
  balance: number;
  canAfford: boolean;
  /** Within human hours with at least one solver for the subject online. */
  humansLikely: boolean;
  botOn: boolean;
  attempted: boolean;
  /** "Ask again": solvers this student may ask for first in this subject. */
  mySolvers: MySolver[];
  openRequestId: string | null;
};

export async function quoteLiveHelp(studentId: string, questionId: string, now: Date = new Date()): Promise<LiveHelpQuote> {
  const access = await getNowAccess(studentId, now);
  const empty: LiveHelpQuote = {
    available: false,
    blockedReason: access.blockedReason,
    priceCoins: null,
    botPriceCoins: null,
    minutes: null,
    balance: 0,
    canAfford: false,
    humansLikely: false,
    botOn: false,
    attempted: false,
    mySolvers: [],
    openRequestId: null,
  };
  if (!access.inCohort) return empty;
  const question = await getOgcodeCatalogQuestionById(questionId);
  const subject = String(question?.subject ?? "").trim().toLowerCase();
  const difficulty = normalizeDifficulty(question?.difficulty);
  if (!question || !isNowSubject(subject) || !difficulty) return { ...empty, blockedReason: "question_not_supported" };
  if (access.canRequest) await ensureWelcomeGrant(studentId);
  const [settings, { rows: prices }, balance, progress, openRequestId, online, mySolvers] = await Promise.all([
    getNowSettings(),
    loadPriceTable(),
    getWalletBalance(studentId, now),
    isOgcodeProgressAvailable() ? getOgcodeQuestionProgress(studentId, questionId) : Promise.resolve(null),
    getOpenRequestId(studentId),
    listOnlineHelpers(subject, now.getTime()).catch(() => new Map<string, number>()),
    listMySolvers(studentId, subject, now),
  ]);
  const human = lookupPrice(prices, difficulty, "human");
  const bot = lookupPrice(prices, difficulty, "bot");
  const botOn = botRuleForSubject(settings.bot, subject).enabled;
  const attempted = Boolean(progress && (progress.attempted || progress.totalAttempts > 0 || progress.answerRevealed));
  const humansLikely = isWithinOpenHours(settings.openHours, now) && online.size > 0;
  // The student pays the bot price when the bot is the likely solver.
  const price = humansLikely || !botOn ? human : (bot ?? human);
  return {
    available: access.canRequest && Boolean(human) && attempted,
    blockedReason: access.canRequest ? (attempted ? null : "attempt_first") : access.blockedReason,
    priceCoins: price?.priceCoins ?? null,
    botPriceCoins: bot?.priceCoins ?? null,
    minutes: price?.minutes ?? null,
    balance: balance.available,
    canAfford: Boolean(human) && balance.available >= (human?.priceCoins ?? Infinity),
    humansLikely,
    botOn,
    attempted,
    mySolvers,
    openRequestId,
  };
}
