import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { BOARD_MAX_BYTES } from "@/lib/now-board";
import { checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";
import { requireAuth } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { createCheckoutOrder } from "@/server/payments/orders-service";
import { hasActiveDeviceToken } from "@/server/push/device-tokens";
import { isPushConfigured } from "@/server/push/fcm";
import { confirmConsent, getConsentStatus, previewConsent, startGuardianConsent } from "@/server/now/consent-service";
import { getSessionBoard, saveSessionBoard } from "@/server/now/board-service";
import { getNowAccess } from "@/server/now/now-access";
import { getNowSettings } from "@/server/now/now-settings";
import { handleNowError, NowError, nowJson } from "@/server/now/now-http";
import {
  acceptAgreement,
  confirmDocumentUpload,
  createDocumentUpload,
  getMyApplication,
  saveApplication,
  startQuiz,
  submitApplication,
  submitQuiz,
} from "@/server/now/solver-service";
import { getWalletSummary, listCoinPacks } from "@/server/now/wallet-service";
import {
  cancelRequest,
  createRequest,
  getCurrentOffer,
  getHelperByUserId,
  getOpenRequestId,
  getRequestView,
  quoteLiveHelp,
  goOffline,
  heartbeatHelper,
  respondToOffer,
} from "@/server/now/dispatch-service";
import { helperStreamId, requestStreamId } from "@/server/now/now-realtime";
import { nowEventStream } from "@/server/now/now-sse";
import {
  confirmExtension,
  endSession,
  joinSession,
  recordOutcome,
  requestExtension,
} from "@/server/now/session-service";
import { REPORT_REASONS } from "@/server/now/after-call-rules";
import {
  blockFromSession,
  getAfterCall,
  rateSession,
  recordPracticeAttempt,
  reportSession,
} from "@/server/now/after-call-service";
import { issueRoomTicket } from "@/server/now/room-service";
import { buyStoreItem, getPaperDownload, listMyOrders, listStoreItems } from "@/server/now/store-service";
import { getSolverDashboard, getStudentDashboard, setFavourite } from "@/server/now/dashboard-service";
import { getMyRoster, setRosterSlot } from "@/server/now/roster-service";
import {
  deleteWebPushSubscription,
  hasWebPushSubscription,
  saveWebPushSubscription,
  webPushPublicKey,
} from "@/server/now/web-push";
import { DECLINE_REASONS, OUTCOMES, ROOT_CAUSES } from "@/server/now/types";

/**
 * Origin NOW student + helper API (plan: V1/ORIGIN_NOW_PLAN.md).
 *
 * Deliberately ONE catch-all route file (plan decision B1): the repo's Next 16
 * "new route 404" incident left brand-new child route files out of the built
 * route table, so every /api/now/* endpoint dispatches from here, the same
 * pattern as /api/mobile/[...slug] and /api/origin-ai/[...slug].
 *
 * Edge policy: "/api/now" is an authenticated prefix and a kill-switch prefix
 * (src/server/route-policy.ts, src/server/incidents.ts). The `originNow` flag,
 * pilot cohort and consent are checked here, per request.
 *
 *   GET  /api/now/me              → access status + wallet (grants welcome coins once)
 *   GET  /api/now/wallet          → balance, recent movements, coin packs
 *   GET  /api/now/wallet/packs    → active coin packs
 *   POST /api/now/wallet/packs    → start a Razorpay order for a pack (web only)
 *   GET  /api/now/consent                       POST /api/now/consent/start
 *   GET  /api/now/consent/preview?token= (public)   POST /api/now/consent/confirm (public)
 *   GET|PUT /api/now/solver/application         POST .../documents, .../documents/confirm,
 *   POST .../agreement, .../submit              POST /api/now/solver/quiz, /solver/quiz/:id/submit
 *
 * Requests and sessions (build step 5):
 *   GET  /api/now/quote?questionId=        → what the "Need human help" button shows (price, balance, state)
 *   POST /api/now/requests                 → ask for live help (holds the coins, starts dispatch)
 *   GET  /api/now/requests/open            → the student's open request, if any
 *   GET|DELETE /api/now/requests/:id       → view / cancel (cancel releases the hold)
 *   GET  /api/now/requests/:id/stream      → SSE for the student and the assigned solver
 *   POST|DELETE /api/now/helper/presence   → solver shift heartbeat ({ subjects, background }) / go offline
 *   GET  /api/now/push/config              → { publicKey, subscribed, native } for offer alerts (browser / Android app)
 *   PUT|DELETE /api/now/push/subscription  → turn this browser's offer alerts on / off
 *   GET  /api/now/helper/stream            → SSE: offers for this solver
 *   GET  /api/now/helper/offers/current    → open offer (push tap, reconnect)
 *   POST /api/now/offers/:id               → { action: accept | decline }
 *   POST /api/now/sessions/:id/join | /end | /outcome | /extend | /extend/confirm
 *   GET|PUT /api/now/sessions/:id/board    → the call's shared board (B89; PUT = the solver's screen saving it)
 *   POST /api/now/sessions/:id/token       → LiveKit ticket for the room (build step 6; POST so the
 *                                             edge kill switch covers it)
 *
 * After the call (build step 7):
 *   GET  /api/now/sessions/:id/after       → rating state, practice questions, report state
 *   POST /api/now/sessions/:id/rate        → { stars, tags, comment?, tipCoins }
 *   POST /api/now/sessions/:id/report      → { reason, details?, block } (either side, live or after)
 *   POST /api/now/sessions/:id/block       → block the other side from future matches
 *   POST /api/now/sessions/:id/practice    → { questionId } the student opened a practice question
 *
 * Origin Store pilot (build step 9; coins only):
 *   GET  /api/now/store/items              → items + this user's balance, ownership, coin premium
 *   POST /api/now/store/items/:id/buy      → Idempotency-Key header; refused inside the Android app
 *   GET  /api/now/store/orders             → my orders
 *   POST /api/now/store/orders/:id/download → 10-minute link to a bought paper (logged)
 *
 * Dashboards (build step 10):
 *   GET  /api/now/me/dashboard?page=       → the student's doubts dashboard
 *   POST|DELETE /api/now/favourites/:helperId
 *   GET  /api/now/solver/dashboard         → the solver dashboard
 *
 * Weekly roster (pilot readiness item 3):
 *   GET  /api/now/solver/roster            → the next 14 evenings and the subjects marked
 *   PUT  /api/now/solver/roster            { day: YYYY-MM-DD, subject, on }
 */

// SSE connections hold the function open; each closes itself after ~50 s.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ slug?: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE";
type Handler = (request: NextRequest, userId: string, params: string[]) => Promise<Response>;

async function handleMe(_request: NextRequest, userId: string): Promise<Response> {
  const access = await getNowAccess(userId);
  const wallet = access.canRequest || access.helper ? await getWalletSummary(userId, { grantWelcome: access.canRequest }) : null;
  return nowJson({ access, wallet });
}

async function handleWallet(_request: NextRequest, userId: string): Promise<Response> {
  const access = await getNowAccess(userId);
  if (!access.canRequest && !access.helper) {
    throw new NowError(403, access.blockedReason ?? "not_invited", "Origin NOW is not open for this account yet.");
  }
  return nowJson(await getWalletSummary(userId, { grantWelcome: access.canRequest }));
}

async function handlePacks(): Promise<Response> {
  return nowJson({ packs: await listCoinPacks() });
}

const BuyPackSchema = z.object({ packId: z.string().trim().min(1).max(80) });

/**
 * Starts a Razorpay order for a coin pack. The client then opens Razorpay
 * Checkout and confirms through the existing /api/payments/verify route,
 * which credits the coins inside applyPaymentSuccess. Refused inside the
 * Android app (Play billing policy, same rule as every other Razorpay surface).
 */
async function handleBuyPack(request: NextRequest, userId: string): Promise<Response> {
  requireFeatureEnabled("payments");
  if (parseAppVersionFromUserAgent(request.headers.get("user-agent")) !== null) {
    throw new NowError(403, "in_app_purchase_blocked", "Coins can be bought on o3origin.com, not inside the app.");
  }
  const access = await getNowAccess(userId);
  if (!access.canRequest && !access.helper) {
    throw new NowError(403, access.blockedReason ?? "not_invited", "Origin NOW is not open for this account yet.");
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    throw new NowError(400, "idempotency_key_required", "An Idempotency-Key header is required.");
  }
  const { packId } = BuyPackSchema.parse(await parseJsonBody(request));
  const limited = await checkRateLimit(mutationLimiter, `now-pack:${userId}`);
  if (limited) return limited;
  const result = await createCheckoutOrder({
    userId,
    kind: "coin_pack",
    packId,
    subject: "",
    termMonths: 1,
    idempotencyKey,
  });
  return nowJson({
    orderId: result.orderId,
    razorpayOrderId: result.razorpayOrderId,
    amountMinor: result.amountMinor,
    currency: result.currency,
    keyId: result.keyId,
    coins: Number(result.order.notes.pack_coins ?? 0),
    bonusCoins: Number(result.order.notes.bonus_coins ?? 0),
  });
}

// ---------------------------------------------------------------------------
// Guardian consent (build step 4).

const StartConsentSchema = z.object({
  purpose: z.enum(["student", "solver"]),
  dateOfBirth: z.string().nullable().optional(),
  guardianName: z.string().max(80).default(""),
  guardianEmail: z.string().max(200).default(""),
  guardianPhone: z.string().max(20).nullable().optional(),
  relationship: z.string().max(40).default(""),
});

const ConfirmConsentSchema = z.object({ token: z.string().min(20).max(200), acceptedPolicy: z.boolean() });

async function handleConsentStatus(_request: NextRequest, userId: string): Promise<Response> {
  return nowJson(await getConsentStatus(userId));
}

async function handleConsentStart(request: NextRequest, userId: string): Promise<Response> {
  const body = StartConsentSchema.parse(await parseJsonBody(request));
  const limited = await checkRateLimit(mutationLimiter, `now-consent:${userId}`);
  if (limited) return limited;
  const result = await startGuardianConsent({
    userId,
    purpose: body.purpose,
    dateOfBirth: body.dateOfBirth ?? null,
    guardianName: body.guardianName,
    guardianEmail: body.guardianEmail,
    guardianPhone: body.guardianPhone ?? null,
    relationship: body.relationship,
  });
  return nowJson({ ...result, status: await getConsentStatus(userId) });
}

/** Public: the guardian has no Origin account. The token is the credential. */
async function handleConsentPreview(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (token.length < 20) throw new NowError(404, "invalid_link", "This consent link is not valid.");
  return nowJson(await previewConsent(token));
}

async function handleConsentConfirm(request: NextRequest): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new NowError(415, "json_required", "Send JSON.");
  }
  const limited = await checkRateLimit(mutationLimiter, `now-consent-confirm:${request.headers.get("x-forwarded-for") ?? "anon"}`);
  if (limited) return limited;
  const { token, acceptedPolicy } = ConfirmConsentSchema.parse(await parseJsonBody(request));
  return nowJson(await confirmConsent({ token, acceptedPolicy }));
}

// ---------------------------------------------------------------------------
// Solver registration (build step 4).

const ApplicationPatchSchema = z.object({
  role: z.string().optional(),
  displayName: z.string().max(60).optional(),
  subjects: z.array(z.string()).max(4).optional(),
  chapters: z.record(z.string(), z.array(z.string()).max(60)).optional(),
  languages: z.array(z.string()).max(8).optional(),
  pan: z.string().max(20).optional(),
});
const UploadSchema = z.object({ kind: z.string(), mimeType: z.string(), sizeBytes: z.number().int() });
const ConfirmUploadSchema = z.object({ kind: z.string(), objectKey: z.string().max(300) });
const AgreementSchema = z.object({ version: z.string().max(40) });
const StartQuizSchema = z.object({ subject: z.string().max(20) });
const SubmitQuizSchema = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(20).nullable()) });

const solverHandlers = {
  get: async (_r: NextRequest, userId: string) => {
    // The application screen needs the agreement version to accept and the quiz rules to show.
    const [application, settings] = await Promise.all([getMyApplication(userId), getNowSettings()]);
    return nowJson({ application, agreementVersion: settings.agreementVersion, quiz: settings.quiz });
  },
  save: async (r: NextRequest, userId: string) =>
    nowJson({ application: await saveApplication(userId, ApplicationPatchSchema.parse(await parseJsonBody(r))) }),
  upload: async (r: NextRequest, userId: string) =>
    nowJson(await createDocumentUpload(userId, UploadSchema.parse(await parseJsonBody(r)))),
  confirmUpload: async (r: NextRequest, userId: string) =>
    nowJson({ application: await confirmDocumentUpload(userId, ConfirmUploadSchema.parse(await parseJsonBody(r))) }),
  agreement: async (r: NextRequest, userId: string) =>
    nowJson({ application: await acceptAgreement(userId, AgreementSchema.parse(await parseJsonBody(r)).version) }),
  submit: async (_r: NextRequest, userId: string) => nowJson({ application: await submitApplication(userId) }),
  startQuiz: async (r: NextRequest, userId: string) =>
    nowJson({ quiz: await startQuiz(userId, StartQuizSchema.parse(await parseJsonBody(r)).subject) }),
  submitQuiz: async (r: NextRequest, userId: string, [attemptId]: string[]) =>
    nowJson(await submitQuiz(userId, attemptId, SubmitQuizSchema.parse(await parseJsonBody(r)).answers)),
};

// ---------------------------------------------------------------------------
// Requests, offers and sessions (build step 5).

const CreateRequestSchema = z.object({
  questionId: z.string().trim().min(1).max(120),
  language: z.string().max(30).nullable().optional(),
  aiExplained: z.boolean().optional(),
  originAiSessionId: z.string().max(120).nullable().optional(),
  /** "Ask again": one of the student's own solvers to ask first. */
  preferredHelperId: z.string().trim().min(1).max(120).nullable().optional(),
});
const PresenceSchema = z.object({
  subjects: z.array(z.string().max(20)).max(4).nullable().optional(),
  /** Sent from a hidden tab by a solver with offer alerts on (decision B85). */
  background: z.boolean().optional(),
});
const PushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000),
  keys: z.object({ p256dh: z.string().max(200).nullable().optional(), auth: z.string().max(100).nullable().optional() }).nullable().optional(),
});
const PushEndpointSchema = z.object({ endpoint: z.string().max(1000) });
const OfferResponseSchema = z.object({
  action: z.enum(["accept", "decline"]),
  reason: z.enum(DECLINE_REASONS).nullable().optional(),
});
const EndSchema = z.object({
  outcome: z.enum(OUTCOMES).nullable().optional(),
  rootCause: z.enum(ROOT_CAUSES).nullable().optional(),
});
const RateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).max(5).default([]),
  comment: z.string().max(500).nullable().optional(),
  tipCoins: z.number().int().min(0).max(100_000).default(0),
});
const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).nullable().optional(),
  block: z.boolean().default(false),
});
const PracticeSchema = z.object({ questionId: z.string().trim().min(1).max(120) });
const RosterSlotSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subject: z.string().trim().toLowerCase().max(40),
  on: z.boolean(),
});
const OutcomeSchema = z.object({ outcome: z.enum(OUTCOMES), rootCause: z.enum(ROOT_CAUSES).nullable().optional() });

async function limitMutation(key: string): Promise<Response | null> {
  return checkRateLimit(mutationLimiter, key);
}

const liveHandlers = {
  create: async (r: NextRequest, userId: string) => {
    const body = CreateRequestSchema.parse(await parseJsonBody(r));
    const limited = await limitMutation(`now-request:${userId}`);
    if (limited) return limited;
    return nowJson({ request: await createRequest(userId, body) }, { status: 201 });
  },
  quote: async (r: NextRequest, userId: string) => {
    const questionId = r.nextUrl.searchParams.get("questionId")?.trim() ?? "";
    if (!questionId || questionId.length > 120) throw new NowError(400, "invalid", "questionId is required.");
    return nowJson({ quote: await quoteLiveHelp(userId, questionId) }, { headers: { "Cache-Control": "no-store" } });
  },
  open: async (_r: NextRequest, userId: string) => {
    const id = await getOpenRequestId(userId);
    return nowJson({ request: id ? await getRequestView(id, { viewerUserId: userId }) : null });
  },
  view: async (_r: NextRequest, userId: string, [id]: string[]) =>
    nowJson({ request: await getRequestView(id, { viewerUserId: userId }) }),
  cancel: async (_r: NextRequest, userId: string, [id]: string[]) =>
    nowJson({ request: await cancelRequest(userId, id) }),
  requestStream: async (r: NextRequest, userId: string, [id]: string[]) => {
    await getRequestView(id, { viewerUserId: userId }); // 404 unless student or assigned solver
    return nowEventStream(r, {
      streamId: requestStreamId(id),
      snapshot: async () => ({ type: "snapshot", request: await getRequestView(id, { viewerUserId: userId }) }),
      stillAllowed: async () => {
        try {
          await getRequestView(id, { viewerUserId: userId });
          return true;
        } catch {
          return false;
        }
      },
      closeOn: ["closed", "settled"],
    });
  },
  presence: async (r: NextRequest, userId: string) => {
    const body = PresenceSchema.parse(await parseJsonBody(r));
    const shift = await heartbeatHelper(userId, body.subjects ?? null, new Date(), { background: body.background === true });
    return nowJson({ ...shift, offer: await getCurrentOffer(userId) });
  },
  offline: async (_r: NextRequest, userId: string) => {
    await goOffline(userId);
    return nowJson({ ok: true });
  },
  helperStream: async (r: NextRequest, userId: string) => {
    const helper = await getHelperByUserId(userId);
    if (!helper) throw new NowError(403, "not_a_solver", "Only approved solvers can do this.");
    return nowEventStream(r, {
      streamId: helperStreamId(helper.id),
      snapshot: async () => ({ type: "snapshot", offer: await getCurrentOffer(userId) }),
      stillAllowed: async () => (await getHelperByUserId(userId))?.verification_status === "verified",
    });
  },
  currentOffer: async (_r: NextRequest, userId: string) => nowJson({ offer: await getCurrentOffer(userId) }),
  respond: async (r: NextRequest, userId: string, [offerId]: string[]) => {
    const body = OfferResponseSchema.parse(await parseJsonBody(r));
    return nowJson(await respondToOffer(userId, offerId, body.action, body.reason ?? null));
  },
  join: async (_r: NextRequest, userId: string, [id]: string[]) => nowJson(await joinSession(userId, id)),
  end: async (r: NextRequest, userId: string, [id]: string[]) => {
    const body = EndSchema.parse(await parseJsonBody(r));
    return nowJson(await endSession({ userId }, id, { outcome: body.outcome ?? null, rootCause: body.rootCause ?? null }));
  },
  outcome: async (r: NextRequest, userId: string, [id]: string[]) => {
    const body = OutcomeSchema.parse(await parseJsonBody(r));
    return nowJson(await recordOutcome(userId, id, body.outcome, body.rootCause ?? null));
  },
  extend: async (_r: NextRequest, userId: string, [id]: string[]) => {
    const limited = await limitMutation(`now-extend:${userId}`);
    if (limited) return limited;
    return nowJson(await requestExtension(userId, id));
  },
  confirmExtend: async (_r: NextRequest, userId: string, [id]: string[]) =>
    nowJson(await confirmExtension({ helperUserId: userId }, id)),
  afterCall: async (_r: NextRequest, userId: string, [id]: string[]) => nowJson({ after: await getAfterCall(userId, id) }),
  rate: async (r: NextRequest, userId: string, [id]: string[]) => {
    const body = RateSchema.parse(await parseJsonBody(r));
    const limited = await limitMutation(`now-rate:${userId}`);
    if (limited) return limited;
    return nowJson({ after: await rateSession(userId, id, { ...body, comment: body.comment ?? null }) });
  },
  report: async (r: NextRequest, userId: string, [id]: string[]) => {
    const body = ReportSchema.parse(await parseJsonBody(r));
    const limited = await limitMutation(`now-report:${userId}`);
    if (limited) return limited;
    return nowJson(await reportSession(userId, id, { reason: body.reason, details: body.details ?? null, block: body.block }), { status: 201 });
  },
  block: async (_r: NextRequest, userId: string, [id]: string[]) => nowJson(await blockFromSession(userId, id)),
  practice: async (r: NextRequest, userId: string, [id]: string[]) =>
    nowJson(await recordPracticeAttempt(userId, id, PracticeSchema.parse(await parseJsonBody(r)).questionId)),
  studentDashboard: async (r: NextRequest, userId: string) => {
    const access = await getNowAccess(userId);
    if (!access.inCohort) throw new NowError(403, access.blockedReason ?? "not_invited", "Origin NOW is not open for this account yet.");
    const page = Number(r.nextUrl.searchParams.get("page") ?? "0");
    return nowJson({ dashboard: await getStudentDashboard(userId, { page: Number.isFinite(page) ? page : 0 }) });
  },
  favourite: async (_r: NextRequest, userId: string, [helperId]: string[]) => nowJson(await setFavourite(userId, helperId, true)),
  unfavourite: async (_r: NextRequest, userId: string, [helperId]: string[]) => nowJson(await setFavourite(userId, helperId, false)),
  solverDashboard: async (_r: NextRequest, userId: string) => nowJson({ dashboard: await getSolverDashboard(userId) }),
  roster: async (_r: NextRequest, userId: string) => nowJson({ roster: await getMyRoster(userId) }),
  pushConfig: async (_r: NextRequest, userId: string) =>
    nowJson({
      publicKey: webPushPublicKey(),
      subscribed: await hasWebPushSubscription(userId),
      // The Android app (B88): FCM set up on the server, and this user has a device registered.
      native: { configured: isPushConfigured(), subscribed: isPushConfigured() && (await hasActiveDeviceToken(userId)) },
    }),
  pushSubscribe: async (r: NextRequest, userId: string) => {
    const body = PushSubscriptionSchema.parse(await parseJsonBody(r));
    await saveWebPushSubscription(userId, body, r.headers.get("user-agent"));
    return nowJson({ subscribed: true });
  },
  pushUnsubscribe: async (r: NextRequest, userId: string) => {
    const body = PushEndpointSchema.parse(await parseJsonBody(r));
    await deleteWebPushSubscription(userId, body.endpoint);
    return nowJson({ subscribed: await hasWebPushSubscription(userId) });
  },
  setRoster: async (r: NextRequest, userId: string) => {
    const body = RosterSlotSchema.parse(await parseJsonBody(r));
    return nowJson({ roster: await setRosterSlot(userId, body) });
  },
  storeItems: async (_r: NextRequest, userId: string) => nowJson(await listStoreItems(userId)),
  storeBuy: async (r: NextRequest, userId: string, [id]: string[]) => {
    // Play billing policy: digital goods paid with coins bought outside Play stay web-only, like coin packs.
    if (parseAppVersionFromUserAgent(r.headers.get("user-agent")) !== null) {
      throw new NowError(403, "in_app_purchase_blocked", "Store purchases are made on o3origin.com, not inside the app.");
    }
    const idempotencyKey = r.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 120) {
      throw new NowError(400, "idempotency_key_required", "An Idempotency-Key header is required.");
    }
    const limited = await limitMutation(`now-store:${userId}`);
    if (limited) return limited;
    return nowJson(await buyStoreItem(userId, id, idempotencyKey), { status: 201 });
  },
  storeOrders: async (_r: NextRequest, userId: string) => nowJson({ orders: await listMyOrders(userId) }),
  storeDownload: async (_r: NextRequest, userId: string, [id]: string[]) =>
    nowJson(await getPaperDownload(userId, id), { headers: { "Cache-Control": "no-store" } }),
  roomTicket: async (_r: NextRequest, userId: string, [id]: string[]) => {
    const limited = await limitMutation(`now-room-token:${userId}`);
    if (limited) return limited;
    return nowJson({ ticket: await issueRoomTicket(userId, id) }, { headers: { "Cache-Control": "no-store" } });
  },
  board: async (_r: NextRequest, userId: string, [id]: string[]) =>
    nowJson({ board: await getSessionBoard(userId, id) }, { headers: { "Cache-Control": "no-store" } }),
  saveBoard: async (r: NextRequest, userId: string, [id]: string[]) => {
    // Refuse oversized bodies before reading them (the service checks the exact size too).
    if (Number(r.headers.get("content-length") ?? 0) > BOARD_MAX_BYTES * 2) {
      throw new NowError(413, "board_too_large", "The board is full. Clear a page to keep writing.");
    }
    const body = (await parseJsonBody(r)) as { board?: unknown };
    return nowJson(await saveSessionBoard(userId, id, body.board));
  },
};

/** Routes keyed by method + path; ":id" segments are passed through as params. */
const ROUTES: { method: Method; pattern: string[]; handler: Handler; public?: boolean }[] = [
  { method: "GET", pattern: ["me"], handler: handleMe },
  { method: "GET", pattern: ["wallet"], handler: handleWallet },
  { method: "GET", pattern: ["wallet", "packs"], handler: handlePacks },
  { method: "POST", pattern: ["wallet", "packs"], handler: handleBuyPack },
  { method: "GET", pattern: ["consent"], handler: handleConsentStatus },
  { method: "POST", pattern: ["consent", "start"], handler: handleConsentStart },
  { method: "GET", pattern: ["consent", "preview"], handler: handleConsentPreview, public: true },
  { method: "POST", pattern: ["consent", "confirm"], handler: handleConsentConfirm, public: true },
  { method: "GET", pattern: ["solver", "application"], handler: solverHandlers.get },
  { method: "PUT", pattern: ["solver", "application"], handler: solverHandlers.save },
  { method: "POST", pattern: ["solver", "application", "documents"], handler: solverHandlers.upload },
  { method: "POST", pattern: ["solver", "application", "documents", "confirm"], handler: solverHandlers.confirmUpload },
  { method: "POST", pattern: ["solver", "application", "agreement"], handler: solverHandlers.agreement },
  { method: "POST", pattern: ["solver", "application", "submit"], handler: solverHandlers.submit },
  { method: "POST", pattern: ["solver", "quiz"], handler: solverHandlers.startQuiz },
  { method: "POST", pattern: ["solver", "quiz", ":id", "submit"], handler: solverHandlers.submitQuiz },
  { method: "GET", pattern: ["quote"], handler: liveHandlers.quote },
  { method: "POST", pattern: ["requests"], handler: liveHandlers.create },
  { method: "GET", pattern: ["requests", "open"], handler: liveHandlers.open },
  { method: "GET", pattern: ["requests", ":id"], handler: liveHandlers.view },
  { method: "DELETE", pattern: ["requests", ":id"], handler: liveHandlers.cancel },
  { method: "GET", pattern: ["requests", ":id", "stream"], handler: liveHandlers.requestStream },
  { method: "POST", pattern: ["helper", "presence"], handler: liveHandlers.presence },
  { method: "DELETE", pattern: ["helper", "presence"], handler: liveHandlers.offline },
  { method: "GET", pattern: ["push", "config"], handler: liveHandlers.pushConfig },
  { method: "PUT", pattern: ["push", "subscription"], handler: liveHandlers.pushSubscribe },
  { method: "DELETE", pattern: ["push", "subscription"], handler: liveHandlers.pushUnsubscribe },
  { method: "GET", pattern: ["helper", "stream"], handler: liveHandlers.helperStream },
  { method: "GET", pattern: ["helper", "offers", "current"], handler: liveHandlers.currentOffer },
  { method: "POST", pattern: ["offers", ":id"], handler: liveHandlers.respond },
  { method: "POST", pattern: ["sessions", ":id", "join"], handler: liveHandlers.join },
  { method: "POST", pattern: ["sessions", ":id", "end"], handler: liveHandlers.end },
  { method: "POST", pattern: ["sessions", ":id", "outcome"], handler: liveHandlers.outcome },
  { method: "POST", pattern: ["sessions", ":id", "extend"], handler: liveHandlers.extend },
  { method: "POST", pattern: ["sessions", ":id", "extend", "confirm"], handler: liveHandlers.confirmExtend },
  { method: "POST", pattern: ["sessions", ":id", "token"], handler: liveHandlers.roomTicket },
  { method: "GET", pattern: ["sessions", ":id", "board"], handler: liveHandlers.board },
  { method: "PUT", pattern: ["sessions", ":id", "board"], handler: liveHandlers.saveBoard },
  { method: "GET", pattern: ["sessions", ":id", "after"], handler: liveHandlers.afterCall },
  { method: "GET", pattern: ["me", "dashboard"], handler: liveHandlers.studentDashboard },
  { method: "POST", pattern: ["favourites", ":id"], handler: liveHandlers.favourite },
  { method: "DELETE", pattern: ["favourites", ":id"], handler: liveHandlers.unfavourite },
  { method: "GET", pattern: ["solver", "dashboard"], handler: liveHandlers.solverDashboard },
  { method: "GET", pattern: ["solver", "roster"], handler: liveHandlers.roster },
  { method: "PUT", pattern: ["solver", "roster"], handler: liveHandlers.setRoster },
  { method: "GET", pattern: ["store", "items"], handler: liveHandlers.storeItems },
  { method: "POST", pattern: ["store", "items", ":id", "buy"], handler: liveHandlers.storeBuy },
  { method: "GET", pattern: ["store", "orders"], handler: liveHandlers.storeOrders },
  { method: "POST", pattern: ["store", "orders", ":id", "download"], handler: liveHandlers.storeDownload },
  { method: "POST", pattern: ["sessions", ":id", "rate"], handler: liveHandlers.rate },
  { method: "POST", pattern: ["sessions", ":id", "report"], handler: liveHandlers.report },
  { method: "POST", pattern: ["sessions", ":id", "block"], handler: liveHandlers.block },
  { method: "POST", pattern: ["sessions", ":id", "practice"], handler: liveHandlers.practice },
];

function match(
  method: Method,
  segments: string[],
): { handler: Handler; params: string[]; isPublic: boolean } | null {
  for (const route of ROUTES) {
    if (route.method !== method || route.pattern.length !== segments.length) continue;
    const params: string[] = [];
    const ok = route.pattern.every((part, i) => {
      if (part === ":id") {
        params.push(segments[i]);
        return true;
      }
      return part === segments[i];
    });
    if (ok) return { handler: route.handler, params, isPublic: Boolean(route.public) };
  }
  return null;
}

async function dispatch(method: Method, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    requireFeatureEnabled("originNow");
    const segments = getSlugSegments(await context.params);
    const found = match(method, segments);
    if (!found) throw new NowError(404, "not_found", "Not found.");
    if (found.isPublic) return await found.handler(request, "", found.params);
    const auth = await requireAuth(request);
    return await found.handler(request, auth.userId, found.params);
  } catch (error) {
    return handleNowError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
