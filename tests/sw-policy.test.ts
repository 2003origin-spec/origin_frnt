import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyRequest,
  isCacheablePageResponse,
  LOGOUT_PURGE_CACHE_PREFIX,
  SW_CACHE,
  type ClassifiableRequest,
} from "../src/sw/policy";

/**
 * Service-worker strategy table (ANDROID_HYBRID_APP_PLAN.md §6.2). These
 * rules are the safety boundary of the offline layer: a misclassification
 * can cache an auth response or buffer an SSE stream, so every row of the
 * table is pinned here.
 */

function request(overrides: Partial<ClassifiableRequest>): ClassifiableRequest {
  return {
    method: "GET",
    mode: "cors",
    destination: "",
    pathname: "/",
    sameOrigin: true,
    hasRscParam: false,
    hasRscHeader: false,
    ...overrides,
  };
}

test("sw: every /api request bypasses the worker — auth, reads, and SSE streams alike", () => {
  assert.equal(classifyRequest(request({ pathname: "/api/users/me" })), "bypass");
  assert.equal(classifyRequest(request({ pathname: "/api/users/token/refresh" })), "bypass");
  // SSE endpoints (CBT/study rooms, AI streams) must never be buffered.
  assert.equal(classifyRequest(request({ pathname: "/api/study-rooms/room_1/events" })), "bypass");
  // Even an API request that carries navigation-ish attributes stays bypassed.
  assert.equal(
    classifyRequest(request({ pathname: "/api/mobile/config", mode: "navigate", destination: "document" })),
    "bypass",
  );
});

test("sw: non-GET and cross-origin requests are never handled", () => {
  assert.equal(classifyRequest(request({ method: "POST", pathname: "/dashboard" })), "bypass");
  assert.equal(classifyRequest(request({ method: "PUT", pathname: "/_next/static/x.js" })), "bypass");
  assert.equal(classifyRequest(request({ sameOrigin: false, destination: "image", pathname: "/x.png" })), "bypass");
});

test("sw: page navigations classify as navigation regardless of path", () => {
  assert.equal(classifyRequest(request({ mode: "navigate", destination: "document", pathname: "/dashboard" })), "navigation");
  assert.equal(classifyRequest(request({ mode: "navigate", destination: "document", pathname: "/auth" })), "navigation");
});

test("sw: hashed build assets are static; optimizer output and media are assets", () => {
  assert.equal(classifyRequest(request({ pathname: "/_next/static/chunks/app.js", destination: "script" })), "static");
  assert.equal(classifyRequest(request({ pathname: "/_next/image", destination: "image" })), "asset");
  assert.equal(classifyRequest(request({ pathname: "/logo/origin.png", destination: "image" })), "asset");
  assert.equal(classifyRequest(request({ pathname: "/fonts/x.woff2", destination: "font" })), "asset");
  // Video/audio deliberately bypass (range requests; large files).
  assert.equal(classifyRequest(request({ pathname: "/videos/intro.mp4", destination: "video" })), "bypass");
});

test("sw: RSC payload fetches classify via _rsc param or rsc header", () => {
  assert.equal(classifyRequest(request({ pathname: "/dashboard", hasRscParam: true })), "rsc");
  assert.equal(classifyRequest(request({ pathname: "/dashboard", hasRscHeader: true })), "rsc");
  // Plain same-origin GET fetches (e.g. JSON from a route handler outside
  // /api — none exist today) stay untouched.
  assert.equal(classifyRequest(request({ pathname: "/dashboard" })), "bypass");
});

test("sw: cacheability guard refuses redirects, non-200s and auth surfaces", () => {
  assert.ok(isCacheablePageResponse({ status: 200, redirected: false, pathname: "/dashboard" }));
  // A logged-out /dashboard follows its 307 to /auth — caching the followed
  // response would poison the /dashboard cache key with the login page.
  assert.ok(!isCacheablePageResponse({ status: 200, redirected: true, pathname: "/dashboard" }));
  assert.ok(!isCacheablePageResponse({ status: 404, redirected: false, pathname: "/nope" }));
  assert.ok(!isCacheablePageResponse({ status: 200, redirected: false, pathname: "/auth" }));
  assert.ok(!isCacheablePageResponse({ status: 200, redirected: false, pathname: "/auth/refresh" }));
  assert.ok(!isCacheablePageResponse({ status: 200, redirected: false, pathname: "/cbt/login" }));
  assert.ok(!isCacheablePageResponse({ status: 200, redirected: false, pathname: "/account/delete" }));
  // Prefix guard must not over-match sibling paths.
  assert.ok(isCacheablePageResponse({ status: 200, redirected: false, pathname: "/account" }));
});

test("sw: logout purge covers exactly the user-data caches", () => {
  // Runtime caches hold the user's pages/RSC payloads → purged on logout.
  for (const name of [SW_CACHE.pages, SW_CACHE.rsc, SW_CACHE.static, SW_CACHE.assets]) {
    assert.ok(name.startsWith(LOGOUT_PURGE_CACHE_PREFIX), `${name} must be purge-scoped`);
  }
  // The precache only holds the neutral offline shell → survives logout.
  assert.ok(!SW_CACHE.precache.startsWith(LOGOUT_PURGE_CACHE_PREFIX));
});
