import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { badRequest, getSlugSegments, parseJsonBody } from "@/server/http";
import { handleUsersRequest } from "@/server/users";
import { authLimiter, generalLimiter, checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

const COOKIE_OPTS_ACCESS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60, // 24 h — matches server/auth.ts ACCESS_TOKEN_TTL_MS
};

const COOKIE_OPTS_REFRESH = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 d — matches REFRESH_TOKEN_TTL_MS
};

const COOKIE_OPTS_CSRF = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60,
};

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

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

  if (!access) return response as NextResponse;

  const publicData = { ...data };
  delete publicData.access;
  delete publicData.refresh;
  const cookied = NextResponse.json(publicData, { status: response.status });
  cookied.cookies.set("origin_access_token", access, COOKIE_OPTS_ACCESS);
  if (refresh) {
    cookied.cookies.set("origin_refresh_token", refresh, COOKIE_OPTS_REFRESH);
  }
  cookied.cookies.set("origin_csrf", createCsrfToken(), COOKIE_OPTS_CSRF);
  return cookied;
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const slug = getSlugSegments(params);

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const isAuthEndpoint =
    method === "POST" &&
    (slug[0] === "login" || slug[0] === "register" || slug[0] === "google-login" || (slug[0] === "token" && slug[1] === "refresh"));

  if (isAuthEndpoint) {
    const limited = await checkRateLimit(authLimiter, ip);
    if (limited) return limited;
  } else {
    const userId = request.headers.get("x-origin-user-id") ?? ip;
    const limited = await checkRateLimit(generalLimiter, userId);
    if (limited) return limited;
  }

  // Logout — handled here, no users.ts involvement needed
  if (method === "POST" && slug[0] === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("origin_access_token", "", { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
    res.cookies.set("origin_refresh_token", "", { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
    res.cookies.set("origin_csrf", "", { ...COOKIE_OPTS_CSRF, maxAge: 0 });
    return res;
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
