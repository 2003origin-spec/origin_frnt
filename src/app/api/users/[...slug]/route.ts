import { NextResponse, type NextRequest } from "next/server";

import { badRequest, getSlugSegments, parseJsonBody } from "@/server/http";
import { handleUsersRequest } from "@/server/users";
import { resolveTokenToUser, revokeRefreshSession } from "@/server/auth";
import { deleteAccountForUser } from "@/server/account-deletion";
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
import { authLimiter, generalLimiter, refreshLimiter, checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

/**
 * Mirror access + refresh tokens from the JSON response body into HttpOnly
 * cookies so that Server Components and proxy can read them without
 * touching localStorage.
 */
async function withAuthCookies(response: Response): Promise<NextResponse> {
  let data: Record<string, unknown>;
  try {
    data = await response.clone().json();
  } catch {
    return response as NextResponse;
  }

  const access = typeof data.access === "string" ? data.access : null;
  const refresh = typeof data.refresh === "string" ? data.refresh : null;
  const accessFingerprint = typeof data.accessFingerprint === "string" ? data.accessFingerprint : null;

  if (!access || !accessFingerprint) return response as NextResponse;

  const publicData = { ...data };
  delete publicData.access;
  delete publicData.refresh;
  delete publicData.accessFingerprint;
  const cookied = NextResponse.json(publicData, { status: response.status });
  cookied.cookies.set(ACCESS_COOKIE_NAME, access, COOKIE_OPTS_ACCESS);
  cookied.cookies.set(ACCESS_FINGERPRINT_COOKIE_NAME, accessFingerprint, COOKIE_OPTS_ACCESS_FINGERPRINT);
  if (refresh) {
    cookied.cookies.set(REFRESH_COOKIE_NAME, refresh, COOKIE_OPTS_REFRESH);
  }
  cookied.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
  return cookied;
}

function withClearedAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE_NAME, "", { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  response.cookies.set(ACCESS_FINGERPRINT_COOKIE_NAME, "", { ...COOKIE_OPTS_ACCESS_FINGERPRINT, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE_NAME, "", { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  response.cookies.set(CSRF_COOKIE_NAME, "", { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  return response;
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const slug = getSlugSegments(params);

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const isRefreshEndpoint = method === "POST" && slug[0] === "token" && slug[1] === "refresh";
  const isAuthEndpoint =
    method === "POST" &&
    (slug[0] === "login" || slug[0] === "register" || slug[0] === "google-login");

  // Refresh tokens are high-entropy HttpOnly cookies. Do not put routine
  // access-token renewal behind the tight login/register limiter; otherwise
  // bursts across tabs can look like expired sessions on the client. It still
  // gets a generous per-IP flood cap (refresh does a session DB lookup and is
  // public + CSRF-exempt). Incident mode is not honored here — a lockdown must
  // not lock users out of session renewal.
  if (isRefreshEndpoint) {
    const limited = await checkRateLimit(refreshLimiter, `ip:${ip}`, { honorIncidentMode: false });
    if (limited) return limited;
  } else if (isAuthEndpoint) {
    const limited = await checkRateLimit(authLimiter, ip);
    if (limited) return limited;
  } else {
    const userId = request.headers.get("x-origin-user-id") ?? ip;
    const limited = await checkRateLimit(generalLimiter, userId);
    if (limited) return limited;
  }

  // Logout — handled here, no users.ts involvement needed
  if (method === "POST" && slug[0] === "logout") {
    await revokeRefreshSession(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
    const res = NextResponse.json({ ok: true });
    return withClearedAuthCookies(res);
  }

  // Account deletion (Play-required; ANDROID_HYBRID_APP_PLAN.md §5.6).
  // Auth = the session itself; intent = the user re-typing their email.
  // Anonymizes in place, revokes sessions + push tokens, then clears cookies.
  if (method === "POST" && slug[0] === "account" && slug[1] === "delete") {
    const limited = await checkRateLimit(authLimiter, `account-delete:${ip}`);
    if (limited) return limited;

    const user = await resolveTokenToUser(request);
    if (!user) {
      return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      return badRequest("Invalid JSON body.");
    }
    const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim() : "";
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return badRequest("Type your account email exactly to confirm deletion.");
    }

    const result = await deleteAccountForUser(user.id);
    const res = NextResponse.json(result);
    return withClearedAuthCookies(res);
  }

  let payload: Record<string, unknown> = {};
  if (method !== "GET" && method !== "DELETE") {
    try {
      payload = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      return badRequest("Invalid JSON body.");
    }
  }

  const response = await handleUsersRequest(method, slug, request, payload);

  // Auth endpoints: mirror tokens into HttpOnly cookies
  const isLogin = method === "POST" && slug[0] === "login";
  const isRegister = method === "POST" && slug[0] === "register";
  const isGoogleLogin = method === "POST" && slug[0] === "google-login";
  const isRefresh = method === "POST" && slug[0] === "token" && slug[1] === "refresh";

  if ((isLogin || isRegister || isGoogleLogin || isRefresh) && response.ok) {
    return withAuthCookies(response);
  }

  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return dispatch("PATCH", request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
