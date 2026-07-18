import { NextResponse, type NextRequest } from "next/server";

import { badRequest, notFound, ok, parseJsonBody, serviceUnavailable, unauthorized } from "@/server/http";
import { getSlugSegments } from "@/server/http";
import { buildMobileConfig } from "@/server/mobile/config";
import {
  consumeHandoffToken,
  HANDOFF_PURPOSES,
  isHandoffPurpose,
  issueHandoffToken,
  type HandoffPurpose,
} from "@/server/mobile/handoff";
import { registerDeviceToken, revokeDeviceToken } from "@/server/push/device-tokens";
import { createAuthSessionAsync } from "@/server/auth";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  COOKIE_OPTS_ACCESS,
  COOKIE_OPTS_ACCESS_FINGERPRINT,
  COOKIE_OPTS_CSRF,
  COOKIE_OPTS_REFRESH,
  CSRF_COOKIE_NAME,
  createCsrfToken,
  REFRESH_COOKIE_NAME,
} from "@/server/auth-cookies";
import { dbCreateAuthSession, dbFindUserById } from "@/server/db-users";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { withStoreAsync } from "@/server/store";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { authLimiter, checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";

/**
 * Android-app endpoints (ANDROID_HYBRID_APP_PLAN.md §5, decision D6).
 *
 * Deliberately a SINGLE catch-all route file: a previous Next 16 prod
 * incident left a brand-new child route file out of the built route table
 * (fixed then by folding the handler into an existing route — PRs #181/#65),
 * so all app endpoints dispatch from here instead of one file per path.
 *
 * Edge policy (src/server/route-policy.ts): `/api/mobile/config` and
 * `/api/mobile/link-out/consume` are public paths; everything else under
 * `/api/mobile` is an authenticated prefix, so the middleware has already
 * verified the access JWT and injected `x-origin-user-id` before an
 * authenticated handler runs.
 *
 *   GET    /api/mobile/config            → shell governance config (public)
 *   POST   /api/mobile/link-out          → issue one-time browser handoff URL
 *   GET    /api/mobile/link-out/consume  → bootstrap browser session (public)
 *   POST   /api/mobile/push-tokens       → register FCM device token
 *   DELETE /api/mobile/push-tokens       → revoke FCM device token
 */

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

type AuthSessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessFingerprint: string;
};

function requesterUserId(request: NextRequest): string | null {
  return request.headers.get("x-origin-user-id");
}

function handleConfig(): NextResponse {
  const response = NextResponse.json(buildMobileConfig());
  // CDN-cacheable: flipping a value is a Vercel env edit + redeploy; 60 s of
  // staleness is acceptable for every field served here.
  response.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  return response;
}

async function handleLinkOutIssue(request: NextRequest): Promise<Response> {
  const userId = requesterUserId(request);
  if (!userId) return unauthorized();

  const limited = await checkRateLimit(mutationLimiter, `linkout:${userId}`);
  if (limited) return limited;

  let payload: Record<string, unknown> = {};
  try {
    payload = await parseJsonBody<Record<string, unknown>>(request);
  } catch {
    // Empty body is fine — default purpose below.
  }
  const rawPurpose = typeof payload.purpose === "string" ? payload.purpose : "premium";
  if (!isHandoffPurpose(rawPurpose)) return badRequest("Unknown link-out purpose.");
  const purpose: HandoffPurpose = rawPurpose;

  try {
    const token = await issueHandoffToken(userId, purpose);
    const url = new URL("/api/mobile/link-out/consume", getCanonicalSiteUrl());
    url.searchParams.set("token", token);
    return ok({ url: url.toString(), expiresInSeconds: 60 });
  } catch (error) {
    console.error("[mobile] link-out issue failed", error instanceof Error ? error.message : error);
    return serviceUnavailable("Could not start the browser handoff. Please retry.");
  }
}

function toSessionTokens(session: {
  accessToken: string;
  refreshToken: string;
  accessFingerprint?: string;
}): AuthSessionTokens | null {
  // The access JWT is only honored alongside its fingerprint cookie; a
  // session without one would bootstrap a broken browser login, so refuse.
  if (!session.accessFingerprint) return null;
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessFingerprint: session.accessFingerprint,
  };
}

async function createSessionForUser(userId: string): Promise<AuthSessionTokens | null> {
  if (isUserPostgresConfigured()) {
    const user = await dbFindUserById(userId);
    if (!user) return null;
    return toSessionTokens(await dbCreateAuthSession(user.id));
  }
  return withStoreAsync(async (store) => {
    const user = store.users.find((entry) => entry.id === userId);
    if (!user) return null;
    return toSessionTokens(await createAuthSessionAsync(store, user.id));
  });
}

async function handleLinkOutConsume(request: NextRequest): Promise<Response> {
  // Public path: the one-time token IS the credential. Rate-limited under a
  // namespaced key so it never eats into the login limiter's budget.
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const limited = await checkRateLimit(authLimiter, `handoff:${ip}`);
  if (limited) return limited;

  const expired = () => NextResponse.redirect(new URL("/auth?handoff=expired", request.url), 303);

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const record = await consumeHandoffToken(token).catch(() => null);
  if (!record) return expired();

  let session: AuthSessionTokens | null = null;
  try {
    session = await createSessionForUser(record.userId);
  } catch (error) {
    console.error("[mobile] handoff session bootstrap failed", error instanceof Error ? error.message : error);
  }
  if (!session) return expired();

  const target = HANDOFF_PURPOSES[record.purpose];
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.set(ACCESS_COOKIE_NAME, session.accessToken, COOKIE_OPTS_ACCESS);
  response.cookies.set(
    ACCESS_FINGERPRINT_COOKIE_NAME,
    session.accessFingerprint,
    COOKIE_OPTS_ACCESS_FINGERPRINT,
  );
  response.cookies.set(REFRESH_COOKIE_NAME, session.refreshToken, COOKIE_OPTS_REFRESH);
  response.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
  return response;
}

async function handlePushTokenRegister(request: NextRequest): Promise<Response> {
  const userId = requesterUserId(request);
  if (!userId) return unauthorized();

  const limited = await checkRateLimit(mutationLimiter, `push-token:${userId}`);
  if (limited) return limited;

  let payload: Record<string, unknown>;
  try {
    payload = await parseJsonBody<Record<string, unknown>>(request);
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (token.length < 10 || token.length > 4096) return badRequest("Missing or invalid FCM token.");
  const platform = typeof payload.platform === "string" ? payload.platform.slice(0, 32) : "android";
  const appVersionCode =
    typeof payload.appVersionCode === "number" && Number.isFinite(payload.appVersionCode)
      ? Math.trunc(payload.appVersionCode)
      : parseAppVersionFromUserAgent(request.headers.get("user-agent"));

  try {
    await registerDeviceToken({ userId, token, platform, appVersionCode });
    return ok({ registered: true });
  } catch (error) {
    console.error("[mobile] push token register failed", error instanceof Error ? error.message : error);
    return serviceUnavailable("Could not register the device for notifications.");
  }
}

async function handlePushTokenRevoke(request: NextRequest): Promise<Response> {
  const userId = requesterUserId(request);
  if (!userId) return unauthorized();

  let payload: Record<string, unknown>;
  try {
    payload = await parseJsonBody<Record<string, unknown>>(request);
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) return badRequest("Missing FCM token.");

  try {
    await revokeDeviceToken(token);
    return ok({ revoked: true });
  } catch (error) {
    console.error("[mobile] push token revoke failed", error instanceof Error ? error.message : error);
    return serviceUnavailable("Could not revoke the device token.");
  }
}

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  const slug = getSlugSegments(params);

  if (method === "GET" && slug.length === 1 && slug[0] === "config") {
    return handleConfig();
  }
  if (method === "POST" && slug.length === 1 && slug[0] === "link-out") {
    return handleLinkOutIssue(request);
  }
  if (method === "GET" && slug.length === 2 && slug[0] === "link-out" && slug[1] === "consume") {
    return handleLinkOutConsume(request);
  }
  if (method === "POST" && slug.length === 1 && slug[0] === "push-tokens") {
    return handlePushTokenRegister(request);
  }
  if (method === "DELETE" && slug.length === 1 && slug[0] === "push-tokens") {
    return handlePushTokenRevoke(request);
  }
  return notFound();
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
