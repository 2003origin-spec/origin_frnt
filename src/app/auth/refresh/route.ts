import { NextResponse, type NextRequest } from "next/server";

import { refreshAccessToken } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
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

const REQUEST_ID_HEADER = "X-Request-Id";

function requestIdFor(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

function safeNext(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.startsWith("/api/")) {
    return "/dashboard";
  }
  if (rawNext === "/auth" || rawNext.startsWith("/auth/refresh")) {
    return "/dashboard";
  }
  return rawNext;
}

function withResponseHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function withClearedAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE_NAME, "", { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  response.cookies.set(ACCESS_FINGERPRINT_COOKIE_NAME, "", { ...COOKIE_OPTS_ACCESS_FINGERPRINT, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE_NAME, "", { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  response.cookies.set(CSRF_COOKIE_NAME, "", { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  return response;
}

function redirectToAuth(request: NextRequest, requestId: string, next: string): NextResponse {
  const url = new URL("/auth", request.url);
  url.searchParams.set("next", next);
  return withResponseHeaders(withClearedAuthCookies(NextResponse.redirect(url)), requestId);
}

function authServiceUnavailable(requestId: string): NextResponse {
  return withResponseHeaders(
    NextResponse.json(
      { detail: "Session refresh is temporarily unavailable. Please retry in a moment." },
      { status: 503 },
    ),
    requestId,
  );
}

export async function GET(request: NextRequest) {
  const requestId = requestIdFor(request);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return redirectToAuth(request, requestId, next);
  }

  let tokens: Awaited<ReturnType<typeof refreshAccessToken>>;
  try {
    tokens = await refreshAccessToken(refreshToken);
  } catch (error) {
    console.error("[auth-refresh] token refresh failed", error instanceof Error ? error.message : error);
    if (isAuthServiceUnavailableError(error)) {
      return authServiceUnavailable(requestId);
    }
    throw error;
  }

  if (!tokens?.accessToken || !tokens.accessFingerprint) {
    return redirectToAuth(request, requestId, next);
  }

  const response = withResponseHeaders(NextResponse.redirect(new URL(next, request.url)), requestId);
  response.cookies.set(ACCESS_COOKIE_NAME, tokens.accessToken, COOKIE_OPTS_ACCESS);
  response.cookies.set(ACCESS_FINGERPRINT_COOKIE_NAME, tokens.accessFingerprint, COOKIE_OPTS_ACCESS_FINGERPRINT);
  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_COOKIE_NAME, tokens.refreshToken, COOKIE_OPTS_REFRESH);
  }
  response.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
  return response;
}
