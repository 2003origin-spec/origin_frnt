import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMobileConfig } from "@/server/mobile/config";
import { NextRequest } from "next/server";

import { consumeHandoffToken, isHandoffPurpose, issueHandoffToken, peekHandoffToken } from "@/server/mobile/handoff";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "@/server/auth-cookies";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";

test("mobile config defaults are the safe/dark posture", () => {
  delete process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE;
  delete process.env.MOBILE_KILL_SWITCH;
  delete process.env.MOBILE_LINK_OUT_ENABLED;
  const config = buildMobileConfig();
  assert.equal(config.minSupportedVersionCode, 0);
  assert.equal(config.killSwitch, false);
  // Play India anti-steering: purchase link-out ships OFF (plan §10.2).
  assert.equal(config.linkOutEnabled, false);
  assert.equal(config.serviceWorkerEnabled, true);
  assert.equal(config.googleNativeLoginEnabled, true);
  assert.equal(config.webviewFloor, 111);
  assert.ok(!Number.isNaN(Date.parse(config.serverTime)));
});

test("mobile config reads env overrides", () => {
  process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE = "10200";
  process.env.MOBILE_KILL_SWITCH = "1";
  process.env.MOBILE_LINK_OUT_ENABLED = "true";
  try {
    const config = buildMobileConfig();
    assert.equal(config.minSupportedVersionCode, 10200);
    assert.equal(config.killSwitch, true);
    assert.equal(config.linkOutEnabled, true);
  } finally {
    delete process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE;
    delete process.env.MOBILE_KILL_SWITCH;
    delete process.env.MOBILE_LINK_OUT_ENABLED;
  }
});

test("handoff tokens are single-use, purpose-bound and carry the token version", async () => {
  const token = await issueHandoffToken("user-123", "premium", 3);
  assert.ok(token.length >= 32);

  const first = await consumeHandoffToken(token);
  assert.deepEqual(first, { userId: "user-123", purpose: "premium", tokenVersion: 3 });

  // Replay must fail — the token is consumed atomically.
  const second = await consumeHandoffToken(token);
  assert.equal(second, null);
});

test("handoff consumption rejects unknown and oversized tokens", async () => {
  assert.equal(await consumeHandoffToken("not-a-real-token"), null);
  assert.equal(await consumeHandoffToken("x".repeat(500)), null);
  assert.equal(await consumeHandoffToken(""), null);
});

test("handoff purposes are an allowlist (no open-redirect surface)", () => {
  assert.ok(isHandoffPurpose("premium"));
  assert.ok(!isHandoffPurpose("https://evil.example"));
  assert.ok(!isHandoffPurpose("__proto__"));
});

test("shell versionCode parses from the app UA suffix only", () => {
  assert.equal(parseAppVersionFromUserAgent("Mozilla/5.0 ... OriginApp/10203 (Android 15; Pixel 8)"), 10203);
  assert.equal(parseAppVersionFromUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/126.0"), null);
  assert.equal(parseAppVersionFromUserAgent(null), null);
  assert.equal(parseAppVersionFromUserAgent("OriginApp/notanumber"), null);
});

// ── Link-out consume: GET is a no-cookie redirect, POST is a same-origin confirm
// (bug-fix spec 01-auth.md §A4 — login CSRF via a public GET that set cookies).

const SITE = "https://www.o3origin.com";
const CONSUME_URL = `${SITE}/api/mobile/link-out/consume`;
const consumeContext = { params: Promise.resolve({ slug: ["link-out", "consume"] }) };

async function withSeedStore<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  const previousSecret = process.env.AUTH_JWT_SECRET_CURRENT;
  delete process.env.USER_DATABASE_URL;
  process.env.AUTH_JWT_SECRET_CURRENT ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";
  try {
    const { resetStore } = await import("@/server/store");
    const store = resetStore();
    return await fn(store.users[0].id);
  } finally {
    if (previousDatabaseUrl !== undefined) process.env.USER_DATABASE_URL = previousDatabaseUrl;
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET_CURRENT;
  }
}

function confirmRequest(token: string, headers: Record<string, string>): NextRequest {
  const body = new URLSearchParams({ token });
  return new NextRequest(CONSUME_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: body.toString(),
  });
}

test("handoff peek does not consume; consume after peek works exactly once", async () => {
  const token = await issueHandoffToken("user-peek", "premium", 0);
  assert.deepEqual(await peekHandoffToken(token), { userId: "user-peek", purpose: "premium", tokenVersion: 0 });
  assert.deepEqual(await peekHandoffToken(token), { userId: "user-peek", purpose: "premium", tokenVersion: 0 });
  assert.deepEqual(await consumeHandoffToken(token), { userId: "user-peek", purpose: "premium", tokenVersion: 0 });
  assert.equal(await peekHandoffToken(token), null);
  assert.equal(await consumeHandoffToken(token), null);
});

test("GET link-out/consume sets no cookies, does not consume, and 303s to /auth/handoff", async () => {
  const { GET } = await import("@/app/api/mobile/[...slug]/route");
  const token = await issueHandoffToken("user-get", "premium", 0);
  const response = await GET(new NextRequest(`${CONSUME_URL}?token=${token}`), consumeContext);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("set-cookie"), null);
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.origin, SITE);
  assert.equal(location.pathname, "/auth/handoff");
  assert.equal(location.searchParams.get("token"), token);
  // The token is still live for the explicit confirm step.
  assert.deepEqual(await peekHandoffToken(token), { userId: "user-get", purpose: "premium", tokenVersion: 0 });
});

test("POST link-out/consume from another origin is 403 and leaves the token unconsumed", async () => {
  const { POST } = await import("@/app/api/mobile/[...slug]/route");
  const token = await issueHandoffToken("user-xsite", "premium", 0);
  const cases: Array<Record<string, string>> = [
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    { origin: "https://evil.example" },
    { "sec-fetch-site": "cross-site" },
    {},
    // Forged-looking Origin cannot outvote the browser's Sec-Fetch-Site.
    { origin: SITE, "sec-fetch-site": "cross-site" },
    { origin: SITE, "sec-fetch-site": "same-site" },
  ];
  for (const headers of cases) {
    const response = await POST(confirmRequest(token, headers), consumeContext);
    assert.equal(response.status, 403, JSON.stringify(headers));
    assert.equal(response.headers.get("set-cookie"), null, JSON.stringify(headers));
  }
  assert.deepEqual(await peekHandoffToken(token), { userId: "user-xsite", purpose: "premium", tokenVersion: 0 });
});

test("same-origin POST link-out/consume sets the session cookies and 303s to the purpose page, once", async () => {
  const { POST } = await import("@/app/api/mobile/[...slug]/route");
  await withSeedStore(async (userId) => {
    const token = await issueHandoffToken(userId, "premium", 0);
    const response = await POST(
      confirmRequest(token, { origin: SITE, "sec-fetch-site": "same-origin" }),
      consumeContext,
    );
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location") ?? "").pathname, "/premium");
    const cookieNames = response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
    for (const name of [
      ACCESS_COOKIE_NAME,
      ACCESS_FINGERPRINT_COOKIE_NAME,
      REFRESH_COOKIE_NAME,
      CSRF_COOKIE_NAME,
    ]) {
      assert.ok(cookieNames.includes(name), `missing ${name} in ${cookieNames.join(",")}`);
    }

    // Replay: the token was consumed atomically → expired, no cookies.
    const replay = await POST(
      confirmRequest(token, { origin: SITE, "sec-fetch-site": "same-origin" }),
      consumeContext,
    );
    assert.equal(replay.status, 303);
    assert.equal(new URL(replay.headers.get("location") ?? "").search, "?handoff=expired");
    assert.equal(replay.headers.get("set-cookie"), null);
  });
});

test("POST link-out/consume without Sec-Fetch-Site (old browsers) falls back to the Origin check", async () => {
  const { POST } = await import("@/app/api/mobile/[...slug]/route");
  await withSeedStore(async (userId) => {
    const token = await issueHandoffToken(userId, "premium", 0);
    const response = await POST(confirmRequest(token, { origin: SITE }), consumeContext);
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location") ?? "").pathname, "/premium");
  });
});

test("same-origin POST link-out/consume refuses a handoff minted before a token-version bump (A3)", async () => {
  const { POST } = await import("@/app/api/mobile/[...slug]/route");
  await withSeedStore(async (userId) => {
    // The seeded user is at token version 0; a handoff carrying 1 is stale.
    const token = await issueHandoffToken(userId, "premium", 1);
    const response = await POST(
      // Own client IP so the earlier cases' handoff rate-limit budget is not shared.
      confirmRequest(token, { origin: SITE, "sec-fetch-site": "same-origin", "x-forwarded-for": "203.0.113.9" }),
      consumeContext,
    );
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location") ?? "").search, "?handoff=expired");
    assert.equal(response.headers.get("set-cookie"), null);
  });
});
