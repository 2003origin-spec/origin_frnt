import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AUTH_CLIENT_KIND,
  normalizeAuthClientKind,
  resolveAuthClientKind,
} from "../src/server/auth-client-kind";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  COOKIE_OPTS_REFRESH,
  COOKIE_OPTS_REFRESH_NATIVE,
  createRefreshToken,
  createSessionId,
  refreshCookieOptions,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_NATIVE,
  refreshTokenTtlSeconds,
} from "../src/server/auth-jwt";
import { createAuthSessionAsync, rotateAccessToken } from "../src/server/auth";
import { resetStore } from "../src/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 OriginApp/10000 (com.o3origin.app)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function ttlSecondsOf(expiresAt: string, fromMs = Date.now()): number {
  return Math.round((new Date(expiresAt).getTime() - fromMs) / 1000);
}

// ── UA → client kind ────────────────────────────────────────────────────────

test("the android shell UA marker is what distinguishes a native session", () => {
  assert.equal(resolveAuthClientKind(ANDROID_UA), "android");
  assert.equal(resolveAuthClientKind(BROWSER_UA), "web");
});

test("a missing or unparseable User-Agent falls back to the web lifetime", () => {
  assert.equal(resolveAuthClientKind(null), "web");
  assert.equal(resolveAuthClientKind(undefined), "web");
  assert.equal(resolveAuthClientKind(""), "web");
  // Marker present but not the documented `OriginApp/{versionCode}` shape.
  assert.equal(resolveAuthClientKind("OriginApp/notanumber"), "web");
  assert.equal(resolveAuthClientKind("MyOriginApp/10000"), "web");
});

test("normalizeAuthClientKind refuses to widen an untrusted value", () => {
  assert.equal(normalizeAuthClientKind("android"), "android");
  assert.equal(normalizeAuthClientKind("web"), "web");
  // Anything unrecognised must collapse to the SHORTER lifetime, never the
  // longer one — a corrupt column or hostile body can't buy a 10-year session.
  assert.equal(normalizeAuthClientKind("Android"), "web");
  assert.equal(normalizeAuthClientKind("ios"), "web");
  assert.equal(normalizeAuthClientKind(null), "web");
  assert.equal(normalizeAuthClientKind(undefined), "web");
  assert.equal(normalizeAuthClientKind({ kind: "android" }), "web");
  assert.equal(DEFAULT_AUTH_CLIENT_KIND, "web");
});

// ── Lifetimes ───────────────────────────────────────────────────────────────

test("web keeps the 7-day refresh; android gets the until-sign-out lifetime", () => {
  assert.equal(REFRESH_TOKEN_TTL_SECONDS, 7 * 24 * 60 * 60);
  assert.equal(REFRESH_TOKEN_TTL_SECONDS_NATIVE, 10 * 365 * 24 * 60 * 60);
  assert.equal(refreshTokenTtlSeconds("web"), REFRESH_TOKEN_TTL_SECONDS);
  assert.equal(refreshTokenTtlSeconds("android"), REFRESH_TOKEN_TTL_SECONDS_NATIVE);
  assert.ok(REFRESH_TOKEN_TTL_SECONDS_NATIVE > REFRESH_TOKEN_TTL_SECONDS);
});

test("the access TTL is 1 hour for BOTH clients", () => {
  // The android exception is the refresh lifetime only. Access tokens stay
  // short-lived everywhere — that is what keeps revocation effective.
  assert.equal(ACCESS_TOKEN_TTL_SECONDS, 3600);
});

test("refresh cookie maxAge matches the session lifetime per client", () => {
  // The WebView cookie jar evicts on its own maxAge regardless of the DB, so a
  // mismatch here silently strands android sessions the server still honours.
  assert.equal(COOKIE_OPTS_REFRESH.maxAge, REFRESH_TOKEN_TTL_SECONDS);
  assert.equal(COOKIE_OPTS_REFRESH_NATIVE.maxAge, REFRESH_TOKEN_TTL_SECONDS_NATIVE);
  assert.equal(refreshCookieOptions("web").maxAge, REFRESH_TOKEN_TTL_SECONDS);
  assert.equal(refreshCookieOptions("android").maxAge, REFRESH_TOKEN_TTL_SECONDS_NATIVE);
  // Native must not weaken any other flag while changing the lifetime.
  assert.equal(COOKIE_OPTS_REFRESH_NATIVE.httpOnly, true);
  assert.equal(COOKIE_OPTS_REFRESH_NATIVE.sameSite, "strict");
  assert.equal(COOKIE_OPTS_REFRESH_NATIVE.path, COOKIE_OPTS_REFRESH.path);
  assert.equal(COOKIE_OPTS_REFRESH_NATIVE.secure, COOKIE_OPTS_REFRESH.secure);
});

test("createRefreshToken stamps the expiry from the client kind", async () => {
  const now = Date.now();
  const web = await createRefreshToken(createSessionId(), "web");
  const android = await createRefreshToken(createSessionId(), "android");

  assert.equal(web.clientKind, "web");
  assert.equal(android.clientKind, "android");
  assert.ok(Math.abs(ttlSecondsOf(web.refreshTokenExpiresAt, now) - REFRESH_TOKEN_TTL_SECONDS) <= 2);
  assert.ok(
    Math.abs(ttlSecondsOf(android.refreshTokenExpiresAt, now) - REFRESH_TOKEN_TTL_SECONDS_NATIVE) <= 2,
  );
});

test("createRefreshToken defaults to web when no kind is supplied", async () => {
  const issued = await createRefreshToken();
  assert.equal(issued.clientKind, "web");
  assert.ok(Math.abs(ttlSecondsOf(issued.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS) <= 2);
});

// ── Session creation + rotation (seed/store path) ───────────────────────────

test("a session records the client kind it was minted for", async () => {
  const store = resetStore();
  const userId = store.users[0].id;

  const android = await createAuthSessionAsync(store, userId, "android");
  assert.equal(android.clientKind, "android");
  assert.ok(
    Math.abs(ttlSecondsOf(android.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS_NATIVE) <= 2,
  );

  const web = await createAuthSessionAsync(resetStore(), userId, "web");
  assert.equal(web.clientKind, "web");
  assert.ok(Math.abs(ttlSecondsOf(web.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS) <= 2);
});

test("rotation preserves the client kind and re-extends by that lifetime", async () => {
  const store = resetStore();
  const session = await createAuthSessionAsync(store, store.users[0].id, "android");

  const rotated = await rotateAccessToken(store, session);
  assert.ok(rotated);
  // The whole point: a refresh must not silently downgrade an android session
  // to the 7-day web window.
  assert.equal(rotated.clientKind, "android");
  assert.ok(
    Math.abs(ttlSecondsOf(rotated.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS_NATIVE) <= 2,
  );
});

test("a session with no stored kind rotates as web, not android", async () => {
  const store = resetStore();
  const session = await createAuthSessionAsync(store, store.users[0].id, "web");
  // Simulate a row written before client_kind existed.
  delete session.clientKind;

  const rotated = await rotateAccessToken(store, session);
  assert.ok(rotated);
  assert.equal(rotated.clientKind, "web");
  assert.ok(Math.abs(ttlSecondsOf(rotated.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS) <= 2);
});
