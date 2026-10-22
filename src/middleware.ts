import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME, verifyRequestAccessJwt } from "@/server/auth-jwt";
import { checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { findKillSwitchForPath } from "@/server/incidents";
import { getApiRoutePolicy, getAppRoutePolicy, loginPathForTarget, normalizePathname, type RoutePolicy } from "@/server/route-policy";
import { isBearerTokenAuthorized } from "@/server/service-auth";

/** Authenticated surfaces whose mutations ride the shared mutation limiter
 * (and the incident rate-limit mode). The /admin/incidents kill-switch is NOT
 * tied to this list any more: `findKillSwitchForPath` runs for every API
 * request, every method, before the policy branches below. */
const RATE_LIMITED_MUTATION_PREFIXES = [
  "/api/teacher/",
  "/api/admin/",
  "/api/enrollments/",
  "/api/cbt/",
  "/api/contest/",
  // Origin NOW. Plan: V1/ORIGIN_NOW_PLAN.md.
  "/api/now/",
];

const REQUEST_ID_HEADER = "X-Request-Id";
const CANONICAL_HOST = "www.o3origin.com";
const APEX_HOST = "o3origin.com";
const PRODUCTION_VERCEL_HOST = "origin-frnt.vercel.app";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_API_PATHS = new Set([
  // Origin NOW guardian consent: the guardian has no Origin session; the
  // single-use token in the JSON body is the credential (hash-checked,
  // expiring) and the handler requires application/json.
  "/api/now/consent/confirm",
  "/api/users/login",
  "/api/users/register",
  "/api/users/google-login",
  "/api/users/token/refresh",
  // Browser link-out handoff confirm (POST from /auth/handoff): the browser has
  // no session or origin_csrf cookie yet. The handler enforces same-origin
  // (`Origin` + `Sec-Fetch-Site`) and the single-use token is the credential.
  "/api/mobile/link-out/consume",
  // Phase 13 drain receiver: signed by Vercel's drain HMAC, not a
  // session cookie, so the CSRF check would always fail.
  "/api/internal/observability/drain",
  // Razorpay subscriptions webhook: signed by Razorpay's HMAC, not a
  // session cookie, so the CSRF check would always fail.
  "/api/subscriptions/webhook",
  // Connect (Flow-2 batch tuition) webhook: same Razorpay HMAC model.
  "/api/connect/webhook",
  // Rail-A one-time payments webhook: Razorpay signs the raw body with its
  // webhook secret, so there is no session CSRF token to compare.
  "/api/payments/webhook",
  // Payment outbox delivery is authenticated by the internal bearer token and
  // (when configured) QStash's signature, not by a browser session.
  "/api/internal/payments/dispatch",
  "/api/internal/payments/drain",
  // The reconciliation cron is likewise bearer/CRON_SECRET authenticated;
  // POST invocations must not be blocked by the browser CSRF gate.
  "/api/internal/payments/reconcile",
]);

function requestIdFor(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function canonicalHostRedirectUrl(requestUrl: URL): URL | null {
  if (requestUrl.hostname !== APEX_HOST && requestUrl.hostname !== PRODUCTION_VERCEL_HOST) {
    return null;
  }
  const url = new URL(requestUrl.toString());
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return url;
}

function withNoIndex(response: NextResponse, policy: RoutePolicy): NextResponse {
  if (policy.kind !== "public" && policy.kind !== "unconfigured") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function jsonAuthFailure(status: 401 | 403, detail: string, requestId: string): NextResponse {
  return withRequestId(NextResponse.json({ detail, requestId }, { status }), requestId);
}

function killSwitchResponse(killedFlag: string, requestId: string): NextResponse {
  return withRequestId(
    NextResponse.json(
      { detail: `This surface is temporarily disabled by an active incident.`, killedFlag },
      {
        status: 503,
        headers: { "Retry-After": "60" },
      },
    ),
    requestId,
  );
}

/** Where an authenticated user belongs by role. /dashboard is the student
 * home; teachers go to /teacher, admins to /admin. */
function homePathForRole(role: string | undefined | null): string {
  if (role === "teacher") return "/teacher";
  if (role === "admin") return "/admin";
  if (role === "cbt_teacher") return "/cbt";
  return "/dashboard";
}

function redirectToAuth(request: NextRequest, requestId: string): NextResponse {
  const url = request.nextUrl.clone();
  const targetPath = normalizePathname(request.nextUrl.pathname);
  url.pathname = loginPathForTarget(targetPath);
  url.search = "";
  url.searchParams.set("next", `${targetPath}${request.nextUrl.search}`);
  return withRequestId(NextResponse.redirect(url), requestId);
}

function hasRefreshCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
}

function redirectToRefresh(request: NextRequest, requestId: string, nextOverride?: string | null): NextResponse {
  const url = request.nextUrl.clone();
  const currentPath = `${normalizePathname(request.nextUrl.pathname)}${request.nextUrl.search}`;
  url.pathname = "/auth/refresh";
  url.search = "";
  url.searchParams.set("next", safeNext(nextOverride ?? currentPath, currentPath));
  const response = NextResponse.redirect(url);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return withRequestId(response, requestId);
}

function nextWithRequestId(
  request: NextRequest,
  requestId: string,
  policy: RoutePolicy,
  authHeaders?: Record<string, string>,
): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  for (const [name, value] of Object.entries(authHeaders ?? {})) {
    headers.set(name, value);
  }
  return withNoIndex(withRequestId(NextResponse.next({ request: { headers } }), requestId), policy);
}

function isInternalAuthorized(request: NextRequest, policy: Extract<RoutePolicy, { kind: "internal" }>): boolean {
  // Scheduled Vercel invocations carry CRON_SECRET, while manual/internal
  // drains carry INTERNAL_CRON_TOKEN. Keep the edge gate aligned with
  // requireCronCaller(), which accepts either credential.
  return isBearerTokenAuthorized(request, policy.tokenName) || isBearerTokenAuthorized(request, "CRON_SECRET");
}

function isRateLimitedMutationPath(pathname: string, method: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  return RATE_LIMITED_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function clientIdentifierFor(request: NextRequest, claims?: { sub?: string }): string {
  if (claims?.sub) return `u:${claims.sub}`;
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return `ip:${ip || "anonymous"}`;
}

export async function middleware(request: NextRequest) {
  const requestId = requestIdFor(request);
  const canonicalUrl = canonicalHostRedirectUrl(request.nextUrl);
  if (canonicalUrl) {
    return withRequestId(NextResponse.redirect(canonicalUrl, 308), requestId);
  }

  // DEV-ONLY: the mascot sandbox (`/dev/*`) is reachable without auth in
  // development for visual tuning. This branch can never run in production
  // (NODE_ENV === "production"), and is removed together with the sandbox in
  // Phase 5 — see MASCOT_3D_PLAN.md. Does not touch route-policy or its test.
  if (process.env.NODE_ENV !== "production" && request.nextUrl.pathname.startsWith("/dev")) {
    return withRequestId(NextResponse.next(), requestId);
  }

  const pathname = normalizePathname(request.nextUrl.pathname);
  const isApi = pathname.startsWith("/api/");
  const policy = isApi ? getApiRoutePolicy(pathname) : getAppRoutePolicy(pathname);

  if (
    isApi &&
    !SAFE_METHODS.has(request.method.toUpperCase()) &&
    !CSRF_EXEMPT_API_PATHS.has(pathname) &&
    // /api/public/* routes are unauthenticated; they have no session cookie so CSRF is meaningless
    !pathname.startsWith('/api/public/') &&
    // /api/internal/* is bearer-authenticated (INTERNAL_CRON_TOKEN / CRON_SECRET,
    // enforced by the `internal` policy branch below AND re-checked in every
    // handler). Callers are QStash, Vercel Cron and ops scripts: none carries a
    // session cookie, so the double-submit check could only ever 403 them —
    // which is exactly what happened to POST /api/internal/now/timer and
    // /api/internal/rooms/drain. The policy table pins every /api/internal/*
    // path to `internal` (tests/route-policy.test.ts), so this exemption can
    // never widen to a session-authenticated route.
    !pathname.startsWith('/api/internal/') &&
    // /api/cbt-student/* is the anonymous student surface: no Origin session
    // cookie, protected instead by the participant token + SameSite=Lax +
    // JSON content-type requirement enforced in-handler.
    !pathname.startsWith('/api/cbt-student/')
  ) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return jsonAuthFailure(403, "Invalid CSRF token.", requestId);
    }
  }

  // Incident kill-switch (/admin/incidents). Evaluated for EVERY API request —
  // reads included, public/anonymous surfaces included — before any policy
  // branch can short-circuit. It used to live inside the authenticated
  // mutation-limiter block, which meant `contest` (not in the prefix list) and
  // `cbtModule` on the public /api/cbt-student surface could never fire, and
  // no GET was ever refused. FLAG_KILL_PREFIXES deliberately leaves
  // /api/internal/* and the admin management surfaces out of each matcher.
  if (isApi) {
    const killed = await findKillSwitchForPath(pathname);
    if (killed) {
      return killSwitchResponse(killed, requestId);
    }
  }

  if (policy.kind === "unconfigured") {
    if (isApi) {
      return jsonAuthFailure(403, "Route policy is not configured.", requestId);
    }
    return redirectToAuth(request, requestId);
  }

  if (policy.kind === "internal") {
    if (!isInternalAuthorized(request, policy)) {
      return jsonAuthFailure(401, "Invalid internal service token.", requestId);
    }
    return nextWithRequestId(request, requestId, policy);
  }

  if (policy.kind === "public") {
    if (pathname === "/auth") {
      try {
        const claims = await verifyRequestAccessJwt(request);
        const next = request.nextUrl.searchParams.get("next");
        const target = safeNext(next, homePathForRole(claims.role));
        const url = new URL(target, request.nextUrl.origin);
        return withRequestId(NextResponse.redirect(url), requestId);
      } catch {
        if (hasRefreshCookie(request)) {
          return redirectToRefresh(request, requestId, request.nextUrl.searchParams.get("next"));
        }
      }
    }
    return nextWithRequestId(request, requestId, policy);
  }

  let claims;
  try {
    claims = await verifyRequestAccessJwt(request);
  } catch {
    if (isApi) {
      return jsonAuthFailure(401, "Authentication credentials were not provided.", requestId);
    }
    if (hasRefreshCookie(request)) {
      return redirectToRefresh(request, requestId);
    }
    return redirectToAuth(request, requestId);
  }

  // Mutual lockout invariant: a cbt_teacher session may only pass `public` and
  // `role:[cbt_teacher]` policies. Every `authenticated`/`membership` Origin
  // surface is off-limits to it (and, conversely, existing roles fail the
  // `/cbt` role policy below) — CBT teachers stay fully partitioned from the
  // main app. No CBT surface ever uses the `authenticated` policy kind.
  if (claims.role === "cbt_teacher" && (policy.kind === "authenticated" || policy.kind === "membership")) {
    if (isApi) {
      return jsonAuthFailure(403, "You do not have permission to perform this action.", requestId);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/cbt";
    url.search = "";
    return withNoIndex(withRequestId(NextResponse.redirect(url), requestId), policy);
  }

  if (policy.kind === "role" && !policy.roles.includes(claims.role)) {
    if (isApi) {
      return jsonAuthFailure(403, "You do not have permission to perform this action.", requestId);
    }
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(claims.role);
    url.search = "";
    return withNoIndex(withRequestId(NextResponse.redirect(url), requestId), policy);
  }

  if (isApi && isRateLimitedMutationPath(pathname, request.method)) {
    const limited = await checkRateLimit(mutationLimiter, clientIdentifierFor(request, claims));
    if (limited) {
      return withRequestId(limited as unknown as NextResponse, requestId);
    }
  }

  return nextWithRequestId(request, requestId, policy, {
    "x-origin-user-id": claims.sub,
    "x-origin-session-id": claims.sid,
    "x-origin-user-role": claims.role,
  });
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|ply|glb|gltf|obj|mp4|mp3|webm)).*)",
  ],
};
