/**
 * A6 — the REST auth routes set the refresh cookie with the lifetime that
 * matches the session row's client kind: android (shell UA) → until-sign-out,
 * web → 7 days. Before this the route hard-coded the 7-day options, so app
 * users who logged in through /api/users/login were silently logged out on day 8.
 *
 * Runs the real route against the seed store (no Postgres).
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

import { POST } from "@/app/api/users/[...slug]/route";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_NATIVE,
} from "@/server/auth-jwt";
import { resetStore } from "@/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) OriginApp/10000 (com.o3origin.app)";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36";
const SEED_EMAIL = "student@origin.test";
const SEED_PASSWORD = "password123";

/** These exercise the seed-store path, so make sure Postgres is not picked up. */
function withoutPostgres<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  return run().finally(() => {
    if (previous) process.env.USER_DATABASE_URL = previous;
  });
}

function routeContext(slug: string[]) {
  return { params: Promise.resolve({ slug }) };
}

async function login(userAgent: string): Promise<Response> {
  const request = new Request("https://www.o3origin.com/api/users/login", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent },
    body: JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD, role: "student" }),
  });
  return POST(request as NextRequest, routeContext(["login"]));
}

function refreshCookie(response: Response): string {
  const cookie = response.headers.getSetCookie().find((entry) => entry.startsWith(`${REFRESH_COOKIE_NAME}=`));
  assert.ok(cookie, "refresh cookie is set");
  return cookie;
}

function maxAgeOf(cookie: string): number {
  const match = /max-age=(\d+)/i.exec(cookie);
  assert.ok(match, `cookie has Max-Age: ${cookie}`);
  return Number(match[1]);
}

function cookieValue(cookie: string): string {
  return decodeURIComponent(cookie.split(";")[0].slice(REFRESH_COOKIE_NAME.length + 1));
}

test("an android-shell login gets the until-sign-out refresh cookie", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const response = await login(ANDROID_UA);
    assert.equal(response.status, 200);
    assert.equal(maxAgeOf(refreshCookie(response)), REFRESH_TOKEN_TTL_SECONDS_NATIVE);

    // Tokens and the server-derived kind never reach the JSON body.
    const body = (await response.json()) as Record<string, unknown>;
    assert.ok(body.user);
    for (const key of ["access", "refresh", "accessFingerprint", "clientKind"]) {
      assert.equal(key in body, false, `${key} must not be in the public body`);
    }
  });
});

test("a browser login keeps the 7-day refresh cookie", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const response = await login(BROWSER_UA);
    assert.equal(response.status, 200);
    assert.equal(maxAgeOf(refreshCookie(response)), REFRESH_TOKEN_TTL_SECONDS);
  });
});

test("refresh re-issues the cookie with the STORED row's lifetime, not this request's UA", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const loggedIn = await login(ANDROID_UA);
    assert.equal(loggedIn.status, 200);
    const refreshToken = cookieValue(refreshCookie(loggedIn));

    // A refresh from an ordinary browser UA on an android session row must
    // not shorten the cookie — the row is authoritative.
    const request = new Request("https://www.o3origin.com/api/users/token/refresh", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": BROWSER_UA,
        cookie: `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
      },
      body: "{}",
    });
    const refreshed = await POST(request as NextRequest, routeContext(["token", "refresh"]));
    assert.equal(refreshed.status, 200);
    assert.equal(maxAgeOf(refreshCookie(refreshed)), REFRESH_TOKEN_TTL_SECONDS_NATIVE);
    const body = (await refreshed.json()) as Record<string, unknown>;
    assert.equal("clientKind" in body, false);
    assert.equal("refresh" in body, false);
  });
});
