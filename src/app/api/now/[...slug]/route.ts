import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";
import { requireAuth } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { createCheckoutOrder } from "@/server/payments/orders-service";
import { getNowAccess } from "@/server/now/now-access";
import { handleNowError, NowError, nowJson } from "@/server/now/now-http";
import { getWalletSummary, listCoinPacks } from "@/server/now/wallet-service";

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
 */

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

/** Routes keyed "METHOD path"; ":id" segments are passed through as params. */
const ROUTES: { method: Method; pattern: string[]; handler: Handler }[] = [
  { method: "GET", pattern: ["me"], handler: handleMe },
  { method: "GET", pattern: ["wallet"], handler: handleWallet },
  { method: "GET", pattern: ["wallet", "packs"], handler: handlePacks },
  { method: "POST", pattern: ["wallet", "packs"], handler: handleBuyPack },
];

function match(method: Method, segments: string[]): { handler: Handler; params: string[] } | null {
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
    if (ok) return { handler: route.handler, params };
  }
  return null;
}

async function dispatch(method: Method, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    requireFeatureEnabled("originNow");
    const segments = getSlugSegments(await context.params);
    const found = match(method, segments);
    if (!found) throw new NowError(404, "not_found", "Not found.");
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
