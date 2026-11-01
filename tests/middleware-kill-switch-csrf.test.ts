/**
 * Edge-middleware ordering guards (docs/bug-fixes/13-new-infra-android.md
 * findings 2 + 3, docs/bug-fixes/11-new-teacher-admin.md finding 5).
 *
 *  N21 — the CSRF double-submit gate runs before the `internal` policy branch,
 *        so every POST-only /api/internal/* route (QStash-delivered NOW timers,
 *        the rooms drain) answered 403 "Invalid CSRF token." before the bearer
 *        was ever checked. Bearer-authenticated callers carry no session cookie,
 *        so /api/internal/ is now exempt and the bearer is the gate.
 *
 *  N13 — the /admin/incidents kill-switch was only consulted inside the
 *        authenticated mutation-limiter block, so GETs were never refused,
 *        `contest` (not in the prefix list) never fired, and `cbtModule` could
 *        not reach the public /api/cbt-student surface. It now runs for every
 *        API request before any policy branch.
 *
 * These drive the real `middleware()` export with the in-memory incident store
 * (Redis unconfigured in unit CI), the same fallback phase-13-incidents.test.ts
 * relies on.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { middleware } from "../src/middleware";
import { setFlagOverride } from "../src/server/incidents";

const ORIGIN = "http://localhost:3000";

function requestFor(path: string, init?: { method?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), {
    method: init?.method ?? "GET",
    headers: init?.headers,
  });
}

async function withEnv<T>(name: string, value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

// ---------------------------------------------------------------------------
// N21 — /api/internal/* is bearer-gated, not CSRF-gated
// ---------------------------------------------------------------------------

test("N21: POST /api/internal/now/timer without a CSRF cookie passes the CSRF stage and reaches the bearer check", async () => {
  await withEnv("INTERNAL_CRON_TOKEN", undefined, async () => {
    const res = await middleware(requestFor("/api/internal/now/timer", { method: "POST" }));
    // No bearer configured/presented → the INTERNAL branch answers 401. Before
    // the fix this was a 403 "Invalid CSRF token." that no QStash delivery
    // could ever satisfy.
    assert.equal(res.status, 401);
    const body = (await res.json()) as { detail: string };
    assert.equal(body.detail, "Invalid internal service token.");
  });
});

test("N21: POST /api/internal/rooms/drain with the internal bearer and no CSRF cookie is let through to the handler", async () => {
  await withEnv("INTERNAL_CRON_TOKEN", "unit-test-internal-token", async () => {
    const res = await middleware(
      requestFor("/api/internal/rooms/drain", {
        method: "POST",
        headers: { authorization: "Bearer unit-test-internal-token" },
      }),
    );
    // NextResponse.next() — the request continues to the route handler.
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-middleware-next"), "1");
  });
});

test("N21: the CSRF gate still refuses a session-authenticated mutation without the double-submit token", async () => {
  const res = await middleware(requestFor("/api/contest/submit", { method: "POST" }));
  assert.equal(res.status, 403);
  const body = (await res.json()) as { detail: string };
  assert.equal(body.detail, "Invalid CSRF token.");
});

// ---------------------------------------------------------------------------
// N13 — the kill-switch covers reads, contest, and the public CBT surface
// ---------------------------------------------------------------------------

test("N13: GET /api/contest/paper returns 503 with the incident payload while `contest` is killed", async () => {
  await setFlagOverride("contest", "off");
  try {
    const res = await middleware(requestFor("/api/contest/paper?contestId=c1"));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("Retry-After"), "60");
    const body = (await res.json()) as { detail: string; killedFlag: string };
    assert.equal(body.killedFlag, "contest");
    assert.match(body.detail, /temporarily disabled by an active incident/);
  } finally {
    await setFlagOverride("contest", "clear");
  }
  // Once cleared the same read falls through to the auth gate (no session → 401),
  // proving the 503 came from the kill-switch and not from the policy branch.
  const after = await middleware(requestFor("/api/contest/paper?contestId=c1"));
  assert.equal(after.status, 401);
});

test("N13: killing `cbtModule` refuses the anonymous /api/cbt-student surface (public policy) on GET and POST", async () => {
  await setFlagOverride("cbtModule", "off");
  try {
    for (const method of ["GET", "POST"]) {
      const res = await middleware(requestFor("/api/cbt-student/state", { method }));
      assert.equal(res.status, 503, `${method} /api/cbt-student/state`);
      const body = (await res.json()) as { killedFlag: string };
      assert.equal(body.killedFlag, "cbtModule");
    }
  } finally {
    await setFlagOverride("cbtModule", "clear");
  }
  // Public surface is open again once the override is cleared.
  const after = await middleware(requestFor("/api/cbt-student/state"));
  assert.equal(after.status, 200);
  assert.equal(after.headers.get("x-middleware-next"), "1");
});

test("killing `adminControlCenter` never 503s the un-kill POST on /api/admin/incidents/kill_switch", async () => {
  await setFlagOverride("adminControlCenter", "off");
  try {
    // The rest of the admin API is down (503 before any auth branch).
    const users = await middleware(requestFor("/api/admin/users"));
    assert.equal(users.status, 503);
    assert.equal(((await users.json()) as { killedFlag: string }).killedFlag, "adminControlCenter");
    // The incidents endpoints fall through to the normal gates instead: without
    // a session the GET answers 401 (auth), the POST 403 (CSRF) — never 503.
    const read = await middleware(requestFor("/api/admin/incidents"));
    assert.equal(read.status, 401, "GET /api/admin/incidents must not be killed");
    const unkill = await middleware(requestFor("/api/admin/incidents/kill_switch", { method: "POST" }));
    assert.equal(unkill.status, 403, "POST kill_switch reaches the CSRF/auth gates, not the kill switch");
    assert.equal(((await unkill.json()) as { detail: string }).detail, "Invalid CSRF token.");
    const launch = await middleware(requestFor("/api/admin/launch"));
    assert.equal(launch.status, 401, "launch settings stay reachable");
  } finally {
    await setFlagOverride("adminControlCenter", "clear");
  }
});

test("N13: killing `contest` leaves the internal contest crons and the admin surface reachable", async () => {
  await setFlagOverride("contest", "off");
  try {
    await withEnv("INTERNAL_CRON_TOKEN", "unit-test-internal-token", async () => {
      const cron = await middleware(
        requestFor("/api/internal/contest/drain", { headers: { authorization: "Bearer unit-test-internal-token" } }),
      );
      assert.equal(cron.status, 200, "drain cron must keep running during a contest incident");
    });
    // Admin management is not killed by `contest`; without a session it hits
    // the auth gate (401), never the 503.
    const admin = await middleware(requestFor("/api/admin/contest/c1/cancel", { method: "GET" }));
    assert.equal(admin.status, 401);
  } finally {
    await setFlagOverride("contest", "clear");
  }
});
