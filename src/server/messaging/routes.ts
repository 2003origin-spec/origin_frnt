/**
 * Student messaging routes, served twice with the same shapes:
 *   - `/api/mobile/messages*` for the native app (dispatched from handleAppApi
 *     in src/server/mobile/app-api.ts; bearer access JWT);
 *   - `/api/messages*` for the website (src/app/api/messages/[[...slug]]/route.ts;
 *     cookie session, CSRF checked by the middleware on writes).
 *
 *   GET  messages?box=inbox|requests      → { conversations, requestCount, usage }
 *   GET  messages/usage                   → { usage }
 *   GET  messages/blocked                 → { people: { person, blockedAt, conversationId }[] }
 *   POST messages/unblock { userId }      → { ok: true }
 *   GET  messages/:id?before=&limit=      → { conversation, messages, hasMore, usage }
 *   POST messages/start  { username? | userId?, text } → { conversation, message, usage }
 *   POST messages/:id    { text }         → { message, usage }
 *   POST messages/:id/accept|decline|block → { conversation }
 *   POST messages/:id/read                → { ok: true }
 *   POST messages/:id/report { reason, note? } → { ok: true }
 *
 * Off unless BOTH `studentMessaging` and `studentSocial` are on (including the
 * /admin/incidents override): every route then answers 404. Students only.
 * Refusals are `{ detail, code }` with a student-readable `detail`; anything
 * else is rethrown for handleAppApi's errorResponse (a plain 500).
 */

import { NextResponse, type NextRequest } from "next/server";

import { getServerUser } from "@/lib/auth-server";
import { isWithinLimit, messagingReportLimiter, messagingSendLimiter } from "@/lib/rate-limit";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { parseJsonBody } from "@/server/http";

import { isReportReason, MessagingError, normalizeMessageText, REPORT_REASONS, type ConversationAction } from "./rules";
import {
  getConversation,
  getUsage,
  listBlocked,
  listConversations,
  markConversationRead,
  reportConversation,
  respondToConversation,
  sendMessage,
  startConversation,
  unblockStudent,
  type Viewer,
} from "./service";

type Body = Record<string, unknown>;

const OFF = { detail: "This feature is not available right now." };
const ACTIONS: readonly ConversationAction[] = ["accept", "decline", "block"];

export async function messagingEnabled(): Promise<boolean> {
  const [messaging, social] = await Promise.all([
    isFeatureEnabledRuntime("studentMessaging"),
    isFeatureEnabledRuntime("studentSocial"),
  ]);
  return messaging && social;
}

function refusal(error: MessagingError): NextResponse {
  return NextResponse.json({ detail: error.message, code: error.code, ...error.extra }, { status: error.status });
}

async function readBody(request: NextRequest): Promise<Body> {
  try {
    const body = await parseJsonBody<Body>(request);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    throw new MessagingError(400, "invalid_body", "Invalid JSON body.");
  }
}

async function requireSendBudget(userId: string): Promise<void> {
  if (!(await isWithinLimit(messagingSendLimiter, userId))) {
    throw new MessagingError(429, "rate_limited", "You're sending messages too fast. Wait a minute and try again.");
  }
}

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

async function route(method: string, request: NextRequest, rest: string[], viewer: Viewer): Promise<Response | null> {
  const [first, action] = rest;

  if (method === "GET") {
    if (rest.length === 0) {
      const box = new URL(request.url).searchParams.get("box") === "requests" ? "requests" : "inbox";
      return NextResponse.json(await listConversations(viewer, box));
    }
    if (rest.length === 1 && first === "usage") return NextResponse.json({ usage: await getUsage(viewer) });
    if (rest.length === 1 && first === "blocked") return NextResponse.json(await listBlocked(viewer));
    if (rest.length === 1) {
      const params = new URL(request.url).searchParams;
      const limit = params.get("limit");
      return NextResponse.json(
        await getConversation(viewer, first, { before: params.get("before"), limit: limit === null ? null : Number(limit) }),
      );
    }
    return null;
  }

  if (method !== "POST" || rest.length === 0 || rest.length > 2) return null;

  if (rest.length === 1 && first === "start") {
    const body = await readBody(request);
    const text = normalizeMessageText(body.text);
    const username = str(body.username);
    const userId = str(body.userId);
    if (!username && !userId) throw new MessagingError(400, "no_recipient", "Choose who to message.");
    await requireSendBudget(viewer.id);
    return NextResponse.json(await startConversation(viewer, { username, userId, text }));
  }

  if (rest.length === 1 && first === "unblock") {
    const body = await readBody(request);
    const userId = str(body.userId);
    if (!userId) throw new MessagingError(400, "no_user", "Choose who to unblock.");
    await unblockStudent(viewer, userId);
    return NextResponse.json({ ok: true });
  }

  if (rest.length === 1) {
    const body = await readBody(request);
    const text = normalizeMessageText(body.text);
    await requireSendBudget(viewer.id);
    return NextResponse.json(await sendMessage(viewer, first, text));
  }

  if ((ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ conversation: await respondToConversation(viewer, first, action as ConversationAction) });
  }
  if (action === "read") {
    await markConversationRead(viewer, first);
    return NextResponse.json({ ok: true });
  }
  if (action === "report") {
    const body = await readBody(request);
    if (!isReportReason(body.reason)) {
      throw new MessagingError(400, "invalid_reason", `Choose a reason: ${REPORT_REASONS.join(", ")}.`);
    }
    if (!(await isWithinLimit(messagingReportLimiter, viewer.id))) {
      throw new MessagingError(429, "rate_limited", "You've sent a lot of reports. Try again later.");
    }
    await reportConversation(viewer, first, body.reason, typeof body.note === "string" ? body.note : null);
    return NextResponse.json({ ok: true });
  }
  return null;
}

/**
 * Handle `/api/mobile/messages[/...]` and `/api/messages[/...]`. `slug[0]` is
 * "messages". Returns null for an unknown path or method (the caller then
 * answers 404).
 */
export async function handleMessagesApi(method: string, request: NextRequest, slug: string[]): Promise<Response | null> {
  if (!(await messagingEnabled())) return NextResponse.json(OFF, { status: 404 });
  const user = await getServerUser();
  if (!user) return NextResponse.json({ detail: "Authentication credentials were not provided." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ detail: "Only students can use messages.", code: "not_student" }, { status: 403 });
  }
  try {
    return await route(method, request, slug.slice(1), { id: user.id, name: user.name || "A student" });
  } catch (error) {
    if (error instanceof MessagingError) return refusal(error);
    throw error;
  }
}
