/**
 * Shared mutation budget moved from the Edge middleware into the app route
 * handlers (finding edge-mutation-limiter-redis).
 *
 * The middleware runs in bom1, far from Upstash, so charging `u:<userId>` there
 * cost every app write (/api/mobile, /api/notes, /api/now) a Mumbai → US round
 * trip. These pin that the budget still applies to every authenticated write
 * on those surfaces — same limiter, same identifier, lockdown honoured — that
 * the middleware no longer charges it twice, and that the other edge prefixes
 * (teacher/admin/...) are unchanged.
 *
 * Runs with the in-memory limiter (Redis unconfigured in unit CI) and a tiny
 * budget, set before the modules load.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.ORIGIN_MUTATION_RATE_LIMIT = "4";
// checkRateLimit refuses the hit that leaves 0 remaining, so a cap of N lets
// N - 1 writes through (pre-existing behaviour, unchanged here).
const ALLOWED = 3;

type SharedModule = typeof import("../../src/server/shared-mutation-limit");
type RateLimitModule = typeof import("../../src/lib/rate-limit");
type IncidentsModule = typeof import("../../src/server/incidents");

let shared: SharedModule;
let rateLimit: RateLimitModule;
let incidents: IncidentsModule;

test.before(async () => {
  shared = await import("../../src/server/shared-mutation-limit");
  rateLimit = await import("../../src/lib/rate-limit");
  incidents = await import("../../src/server/incidents");
});

const SITE = "https://www.o3origin.com";
let userSeq = 0;
const freshUser = () => `user_${process.pid}_${(userSeq += 1)}`;

function req(path: string, method = "POST", headers: Record<string, string> = {}): Request {
  return new Request(new URL(path, SITE), { method, headers });
}

async function exhaust(path: string, userId: string): Promise<Array<number | null>> {
  const statuses: Array<number | null> = [];
  for (let i = 0; i < ALLOWED + 1; i += 1) {
    const res = await shared.checkSharedMutationLimit(req(path), userId);
    statuses.push(res ? res.status : null);
  }
  return statuses;
}

test("writes on all three app surfaces are charged to the shared budget", async () => {
  for (const path of ["/api/mobile/push-tokens", "/api/notes/stars", "/api/now/requests"]) {
    assert.deepEqual(await exhaust(path, freshUser()), [...Array(ALLOWED).fill(null), 429], path);
  }
});

test("one budget per user across the three surfaces (same as the edge limiter)", async () => {
  const user = freshUser();
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), user), null);
  assert.equal(await shared.checkSharedMutationLimit(req("/api/notes/stars", "PUT"), user), null);
  assert.equal(await shared.checkSharedMutationLimit(req("/api/now/requests", "DELETE"), user), null);
  const fourth = await shared.checkSharedMutationLimit(req("/api/mobile/profile", "PATCH"), user);
  assert.equal(fourth?.status, 429);
  // Another user is unaffected.
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), freshUser()), null);
});

test("the identifier is the middleware's `u:<userId>`, so existing budgets carry over", async () => {
  const user = freshUser();
  for (let i = 0; i < ALLOWED; i += 1) {
    assert.equal(await rateLimit.checkRateLimit(rateLimit.mutationLimiter, `u:${user}`), null);
  }
  const res = await shared.checkSharedMutationLimit(req("/api/mobile/profile", "PATCH"), user);
  assert.equal(res?.status, 429);
});

test("reads are never charged", async () => {
  const user = freshUser();
  for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
    for (let i = 0; i < ALLOWED + 2; i += 1) {
      assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/home", method === "get" ? "GET" : method), user), null);
    }
  }
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), user), null, "budget untouched by reads");
});

test("public sub-paths are skipped (their own limiters apply; the user header is client-supplied there)", async () => {
  const user = freshUser();
  for (const path of [
    "/api/mobile/auth/login",
    "/api/mobile/auth/otp/verify",
    "/api/mobile/link-out/consume",
    "/api/now/consent/confirm",
  ]) {
    for (let i = 0; i < ALLOWED + 2; i += 1) {
      assert.equal(await shared.checkSharedMutationLimit(req(path), user), null, path);
    }
  }
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), user), null, "budget untouched");
});

test("no user id → no charge (the handler answers 401 itself)", async () => {
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), null), null);
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), ""), null);
  assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), undefined), null);
});

test("lockdown still refuses every app write", async () => {
  await incidents.setRateLimitMode("lockdown");
  try {
    const res = await shared.checkSharedMutationLimit(req("/api/mobile/tasks"), freshUser());
    assert.equal(res?.status, 429);
    assert.equal(res?.headers.get("X-RateLimit-Mode"), "lockdown");
    // Reads still pass during lockdown.
    assert.equal(await shared.checkSharedMutationLimit(req("/api/mobile/home", "GET"), freshUser()), null);
  } finally {
    await incidents.setRateLimitMode("normal");
  }
});

test("checkRateLimit uses a caller-supplied incident mode instead of reading the snapshot", async () => {
  // Store says normal; the caller's (edge) snapshot says lockdown → refused.
  const locked = await rateLimit.checkRateLimit(rateLimit.mutationLimiter, `u:${freshUser()}`, { incidentMode: "lockdown" });
  assert.equal(locked?.status, 429);
  assert.equal(locked?.headers.get("X-RateLimit-Mode"), "lockdown");
  // strict halves the cap: 4 → 2, so one write passes.
  const user = freshUser();
  assert.equal(await rateLimit.checkRateLimit(rateLimit.mutationLimiter, `u:${user}`, { incidentMode: "strict" }), null);
  const second = await rateLimit.checkRateLimit(rateLimit.mutationLimiter, `u:${user}`, { incidentMode: "strict" });
  assert.equal(second?.status, 429);
  assert.equal(second?.headers.get("X-RateLimit-Mode"), "strict");
});

test("the real mobile route charges the shared budget before dispatch", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../../src/app/api/mobile/[...slug]/route");
  const user = freshUser();
  const call = () =>
    POST(
      new NextRequest(new URL("/api/mobile/no-such-endpoint", SITE), {
        method: "POST",
        headers: { "x-origin-user-id": user, "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ slug: ["no-such-endpoint"] }) },
    );
  const statuses = [];
  for (let i = 0; i < ALLOWED + 1; i += 1) statuses.push((await call()).status);
  for (let i = 0; i < ALLOWED; i += 1) assert.notEqual(statuses[i], 429, `call ${i + 1}`);
  assert.equal(statuses[ALLOWED], 429);
});

test("every catch-all handler under the moved prefixes calls the shared limit", () => {
  assert.deepEqual([...shared.HANDLER_LIMITED_MUTATION_PREFIXES], ["/api/mobile/", "/api/notes/", "/api/now/"]);
  for (const surface of ["mobile", "notes", "now"]) {
    const source = readFileSync(new URL(`../../src/app/api/${surface}/[...slug]/route.ts`, import.meta.url), "utf8");
    assert.match(source, /await checkSharedMutationLimit\(request, /, `${surface} route must charge the shared budget`);
  }
});

// ── Middleware: the moved prefixes are no longer charged at the edge; the
// others still are. Drives the real middleware with a real app JWT.

async function withAppToken<T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  const previousSecret = process.env.AUTH_JWT_SECRET_CURRENT;
  delete process.env.USER_DATABASE_URL;
  process.env.AUTH_JWT_SECRET_CURRENT ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";
  try {
    const { resetStore } = await import("../../src/server/store");
    const { issueAccessTokenForUser } = await import("../../src/server/auth-jwt");
    const store = resetStore();
    const { accessToken, accessFingerprint } = await issueAccessTokenForUser(store.users[0], "sess_shared_limit");
    return await fn({ authorization: `Bearer ${accessToken}`, "x-origin-access-fgp": accessFingerprint });
  } finally {
    if (previousDatabaseUrl !== undefined) process.env.USER_DATABASE_URL = previousDatabaseUrl;
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET_CURRENT;
    else process.env.AUTH_JWT_SECRET_CURRENT = previousSecret;
  }
}

test("middleware lets app writes through without charging; teacher writes are still limited at the edge", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../../src/middleware");
  await withAppToken(async (headers) => {
    for (const path of ["/api/mobile/push-tokens", "/api/notes/stars", "/api/now/requests"]) {
      for (let i = 0; i < ALLOWED + 2; i += 1) {
        const res = await middleware(new NextRequest(new URL(path, SITE), { method: "POST", headers }));
        assert.equal(res.headers.get("x-middleware-next"), "1", `${path} #${i + 1} passes the edge`);
      }
    }
    const statuses = [];
    for (let i = 0; i < ALLOWED + 1; i += 1) {
      const res = await middleware(new NextRequest(new URL("/api/teacher/workspaces", SITE), { method: "POST", headers }));
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, ALLOWED), Array(ALLOWED).fill(200));
    assert.equal(statuses[ALLOWED], 429, "edge limiter still guards /api/teacher writes");
  });
});

test("middleware passes its snapshot's lockdown to the edge limiter", async () => {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("../../src/middleware");
  await withAppToken(async (headers) => {
    await incidents.setRateLimitMode("lockdown");
    try {
      const res = await middleware(new NextRequest(new URL("/api/admin/users", SITE), { method: "POST", headers }));
      assert.equal(res.status, 429);
      assert.equal(res.headers.get("X-RateLimit-Mode"), "lockdown");
    } finally {
      await incidents.setRateLimitMode("normal");
    }
  });
});
