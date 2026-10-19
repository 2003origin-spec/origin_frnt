/**
 * Origin bot solver (build step 8; plan doc "Origin bot solver"): once
 * dispatch assigns the bot, LiveKit is asked to send the Origin Voice agent
 * (origin-ai, solver mode) into the session room with the question, its stored
 * answer and solution. The job metadata goes to the agent only.
 *
 * If LiveKit refuses, the request closes as no_helper (none_online) and the
 * hold is released, so a student is never left alone in a room.
 */

import { getOgcodeCatalogQuestionById } from "@/server/ogcode-catalog";
import { getUserPostgresPool } from "@/server/user-postgres";

import { loadPriceTable } from "./admin-store";
import { applyTransition, lockRequest, logEvent, releaseHold, type RequestRow } from "./dispatch-service";
import { withNowTransaction } from "./ledger-store";
import { botAgentName, createAgentDispatch, getLiveKitConfig, roomNameFor } from "./livekit";
import { publishNowEvent, requestStreamId } from "./now-realtime";
import { ensureNowSchema } from "./now-schema";
import { lookupPrice } from "./pricing";
import { closeRoom } from "./room-service";
import { firstNameOnly } from "./session-rules";

/** Mirrors origin-ai/app/voice_agent/now_solver.py `NowSolverJob` (version 1). */
export type BotJobMetadata = {
  mode: "now_solver";
  v: 1;
  session_id: string;
  request_id: string;
  student_first_name: string;
  language: string | null;
  minutes: number;
  ai_explained: boolean;
  question: {
    subject: string;
    chapter: string | null;
    concept: string | null;
    difficulty: string;
    text: string;
    options: string[];
    correct_option_index: number | null;
    correct_option_indexes: number[] | null;
    answer_text: string | null;
    explanation: string | null;
    hint: string | null;
  };
};

const MAX_TEXT = 4000;
const clip = (value: string | null | undefined, max = MAX_TEXT) => (value ? value.slice(0, max) : null);

/** Pure: the agent's job metadata from what the request and the catalog hold. */
export function buildBotJobMetadata(input: {
  sessionId: string;
  request: Pick<RequestRow, "id" | "subject" | "chapter" | "concept" | "difficulty" | "language" | "ai_explained" | "context_json">;
  studentName: string | null;
  minutes: number;
  catalog: {
    text?: string | null;
    options?: string[] | null;
    correctOption?: number | null;
    correctOptions?: number[] | null;
    answerText?: string | null;
    explanation?: string | null;
    hint?: string | null;
  } | null;
}): BotJobMetadata {
  const shown = (input.request.context_json?.question ?? {}) as { text?: string; options?: string[] };
  const options = (shown.options ?? input.catalog?.options ?? []).slice(0, 10).map((o) => String(o).slice(0, 500));
  return {
    mode: "now_solver",
    v: 1,
    session_id: input.sessionId,
    request_id: input.request.id,
    student_first_name: firstNameOnly(input.studentName),
    language: input.request.language,
    minutes: Math.max(1, Math.min(30, Math.round(input.minutes))),
    ai_explained: input.request.ai_explained,
    question: {
      subject: input.request.subject,
      chapter: clip(input.request.chapter, 200),
      concept: clip(input.request.concept, 200),
      difficulty: input.request.difficulty,
      text: clip(shown.text || input.catalog?.text || "", MAX_TEXT) || "(question text unavailable)",
      options,
      correct_option_index:
        input.catalog?.correctOption !== null && input.catalog?.correctOption !== undefined && input.catalog.correctOption < options.length
          ? input.catalog.correctOption
          : null,
      correct_option_indexes: input.catalog?.correctOptions?.length ? input.catalog.correctOptions.filter((i) => i < options.length) : null,
      answer_text: clip(input.catalog?.answerText, 1000),
      explanation: clip(input.catalog?.explanation),
      hint: clip(input.catalog?.hint, 1000),
    },
  };
}

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type BotDispatchResult = "dispatched" | "skipped" | "failed" | "not_needed";

/** Post-commit effect of `assign_bot`. */
export async function dispatchBotToSession(sessionId: string): Promise<BotDispatchResult> {
  const pool = await db();
  const res = await pool.query<RequestRow & { session_ended_at: Date | null; solver_kind_s: string; student_name: string | null }>(
    `SELECT r.*, s.ended_at AS session_ended_at, s.solver_kind AS solver_kind_s, u.name AS student_name
       FROM now.sessions s JOIN now.requests r ON r.id = s.request_id JOIN origin_users u ON u.id = r.student_id
      WHERE s.id = $1`,
    [sessionId],
  );
  const row = res.rows[0];
  if (!row || row.solver_kind_s !== "bot" || row.session_ended_at || !["accepted", "live"].includes(row.status)) return "not_needed";

  const config = getLiveKitConfig();
  if (!config) {
    // Development without LiveKit: the session still runs end to end (no voice).
    await logEvent(pool, { type: "bot.dispatch_skipped", requestId: row.id, sessionId, actor: "system", payload: { reason: "livekit_not_configured" } });
    return "skipped";
  }

  try {
    const [catalog, prices] = await Promise.all([
      getOgcodeCatalogQuestionById(row.question_id).catch(() => null),
      loadPriceTable(),
    ]);
    const price = lookupPrice(prices.rows, row.difficulty, "bot");
    const metadata = buildBotJobMetadata({
      sessionId,
      request: row,
      studentName: row.student_name,
      minutes: price?.minutes ?? 5,
      catalog,
    });
    const dispatchId = await createAgentDispatch(config, {
      room: roomNameFor(sessionId),
      agentName: botAgentName(),
      metadata: JSON.stringify(metadata),
    });
    await logEvent(pool, {
      type: "bot.dispatched",
      requestId: row.id,
      sessionId,
      actor: "system",
      payload: { dispatchId, agent: botAgentName(), hasSolution: Boolean(metadata.question.explanation) },
    });
    return "dispatched";
  } catch (error) {
    await closeBotUnavailable(sessionId, error instanceof Error ? error.message : String(error));
    return "failed";
  }
}

/** The bot could not be sent: close as no_helper / none_online and give the coins back. */
export async function closeBotUnavailable(sessionId: string, reason: string, now: Date = new Date()): Promise<void> {
  let requestId: string | null = null;
  await withNowTransaction(async (client) => {
    const head = await client.query<{ request_id: string }>(`SELECT request_id FROM now.sessions WHERE id = $1`, [sessionId]);
    const request = head.rows[0] ? await lockRequest(client, head.rows[0].request_id) : null;
    if (!request || request.status !== "accepted") return;
    const ended = await client.query(
      `UPDATE now.sessions SET ended_at = $2, ended_by = 'no_show', payable = FALSE, settled_at = $2
        WHERE id = $1 AND ended_at IS NULL`,
      [sessionId, now],
    );
    if (ended.rowCount !== 1) return;
    await applyTransition(client, request, "bot_unavailable", {
      closed_reason: "no_helper",
      closed_detail: "none_online",
      closed_at: now,
    });
    await releaseHold(client, request);
    await logEvent(client, {
      type: "bot.dispatch_failed",
      requestId: request.id,
      sessionId,
      actor: "system",
      payload: { reason: reason.slice(0, 300) },
    });
    requestId = request.id;
  });
  if (requestId) {
    await publishNowEvent(requestStreamId(requestId), { type: "closed", reason: "no_helper", detail: "none_online" });
    await closeRoom(sessionId);
  }
}
