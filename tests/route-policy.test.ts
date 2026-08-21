import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  PUBLIC_API_PATHS,
  PUBLIC_APP_PATHS,
  getApiRoutePolicy,
  getAppRoutePolicy,
  isKnownApiRouteFile,
  isKnownAppPageFile,
  loginPathForTarget,
} from "../src/server/route-policy";

const root = new URL("..", import.meta.url).pathname;

function walkFiles(dir: string, predicate: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...walkFiles(path, predicate));
    } else if (predicate(path)) {
      out.push(path);
    }
  }
  return out;
}

test("all API route handlers are covered by explicit route policy", () => {
  const routes = walkFiles(join(root, "src/app/api"), (file) => file.endsWith("/route.ts"));
  const uncovered = routes.filter((route) => !isKnownApiRouteFile(route));
  assert.deepEqual(uncovered, []);
});

test("all app page sections are covered by public/authenticated/admin route policy", () => {
  const pages = walkFiles(join(root, "src/app"), (file) => file.endsWith("/page.tsx"))
    // `/dev/*` is a dev-only sandbox (mascot tuning) reachable only via the
    // NODE_ENV!=="production" bypass in middleware.ts; in production it has no
    // policy and is redirected to /auth. Removed before ship — see MASCOT_3D_PLAN.md.
    .filter((page) => !page.includes("/src/app/dev/"));
  const uncovered = pages.filter((page) => !isKnownAppPageFile(page));
  assert.deepEqual(uncovered, []);
});

test("future API routes are denied by default", () => {
  assert.equal(getApiRoutePolicy("/api/new-feature").kind, "unconfigured");
  assert.equal(getAppRoutePolicy("/new-feature").kind, "unconfigured");
});

test("public API allowlist is limited to health, auth entrypoints, the drain receiver, the payment webhooks, landing-page public data, and the mobile shell endpoints", () => {
  assert.deepEqual([...PUBLIC_API_PATHS].sort(), [
    "/api/connect/webhook",
    "/api/health",
    "/api/internal/observability/drain",
    "/api/mobile/config",
    "/api/mobile/link-out/consume",
    "/api/public/activity-feed",
    "/api/public/demo-solve",
    "/api/public/live-stats",
    "/api/subscriptions/webhook",
    "/api/users/google-login",
    "/api/users/login",
    "/api/users/register",
    "/api/users/token/refresh",
  ]);
});

test("mobile shell endpoints: config + handoff consumption are public, everything else authenticated", () => {
  // Config is fetched pre-auth at app cold start; handoff consumption runs in
  // an external browser with no session cookie (the one-time token is the
  // credential, verified in-handler). See ANDROID_HYBRID_APP_PLAN.md §5.
  assert.equal(getApiRoutePolicy("/api/mobile/config").kind, "public");
  assert.equal(getApiRoutePolicy("/api/mobile/link-out/consume").kind, "public");
  assert.equal(getApiRoutePolicy("/api/mobile/link-out").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/mobile/push-tokens").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/mobile").kind, "authenticated");
  // Contest student surface is authenticated; admin contest rides /api/admin.
  assert.equal(getApiRoutePolicy("/api/contest/answers").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/contest/result").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/contest/leaderboard").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/admin/contest").kind, "authenticated");
  // Contest internal cron rides /api/internal (INTERNAL_CRON_TOKEN).
  assert.equal(getApiRoutePolicy("/api/internal/contest/publish-results").kind, "internal");
  // The /contest app pages are authenticated.
  assert.equal(getAppRoutePolicy("/contest/abc/play").kind, "authenticated");
});

test("auth refresh page route is public for expired access-cookie recovery", () => {
  assert.equal(getAppRoutePolicy("/auth/refresh").kind, "public");
  assert.ok((PUBLIC_APP_PATHS as readonly string[]).includes("/auth/refresh"));
});

test("service-worker script and offline fallback are public (offline layer, plan §6)", () => {
  // The worker registers pre-auth for every visitor, and /offline.html is
  // fetched at SW install with no session — an auth redirect would corrupt
  // the precache with the login page.
  assert.equal(getAppRoutePolicy("/sw.js").kind, "public");
  assert.equal(getAppRoutePolicy("/offline.html").kind, "public");
});

test("SEO crawl files (robots.txt, sitemap.xml) are public for bots", () => {
  // Search-engine + AI crawlers hit these with no session; an auth redirect
  // would break indexing.
  assert.equal(getAppRoutePolicy("/robots.txt").kind, "public");
  assert.equal(getAppRoutePolicy("/sitemap.xml").kind, "public");
  assert.equal(getAppRoutePolicy("/llms.txt").kind, "public");
});

test("route handlers do not import low-level JWT primitives directly", () => {
  const routes = walkFiles(join(root, "src/app/api"), (file) => file.endsWith("/route.ts"));
  const offenders = routes.filter((route) => readFileSync(route, "utf8").includes("@/server/auth-jwt"));
  assert.deepEqual(offenders, []);
});

test("known protected policies classify role and room-scoped routes", () => {
  assert.deepEqual(getAppRoutePolicy("/admin/users"), { kind: "role", roles: ["admin"] });
  assert.equal(getApiRoutePolicy("/api/study-rooms/room_1/messages").kind, "membership");
  assert.equal(getApiRoutePolicy("/api/origin-ai/chat").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/ai-access/me").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/internal/refresh-catalog").kind, "internal");
  assert.equal(getAppRoutePolicy("/videos/Instant-Doubt-Resolution.mp4").kind, "public");
  assert.equal(getAppRoutePolicy("/books/12/Biology/Chapter%201.pdf").kind, "authenticated");
});

test("CBT surfaces classify as role/public per the mutual-lockout design", () => {
  // Teacher app + API: role-gated to cbt_teacher (no `authenticated` policy on
  // any CBT surface — that is what locks cbt_teacher out of every Origin route
  // and every other role out of /cbt).
  assert.deepEqual(getAppRoutePolicy("/cbt"), { kind: "role", roles: ["cbt_teacher"] });
  assert.deepEqual(getApiRoutePolicy("/api/cbt/health"), { kind: "role", roles: ["cbt_teacher"] });
  assert.deepEqual(getApiRoutePolicy("/api/cbt/rooms"), { kind: "role", roles: ["cbt_teacher"] });
  // Participation quota: the teacher-facing endpoint inherits the same role
  // prefix, so the feature needed no route-policy edit. Asserted, not assumed.
  assert.deepEqual(getApiRoutePolicy("/api/cbt/quota"), { kind: "role", roles: ["cbt_teacher"] });
  // Public exceptions inside the role-gated /cbt app tree.
  assert.equal(getAppRoutePolicy("/cbt/login").kind, "public");
  assert.equal(getAppRoutePolicy("/cbt/r/abcd1234").kind, "public");
  // Student API surface: public at the edge, participant-token gated in-handler.
  assert.equal(getApiRoutePolicy("/api/cbt-student/health").kind, "public");
  assert.equal(getApiRoutePolicy("/api/cbt-student/join").kind, "public");
  // The student prefix must NOT be swallowed by the /api/cbt role prefix.
  assert.notDeepEqual(getApiRoutePolicy("/api/cbt-student/join"), { kind: "role", roles: ["cbt_teacher"] });
  // Admin CBT rides the existing authenticated /api/admin prefix + requireAdmin.
  assert.equal(getApiRoutePolicy("/api/admin/cbt/teachers").kind, "authenticated");
});

test("unauthenticated /cbt visits redirect to the CBT OTP login, not the password /auth", () => {
  // Role-gated CBT teacher surfaces → the OTP page.
  assert.equal(loginPathForTarget("/cbt"), "/cbt/login");
  assert.equal(loginPathForTarget("/cbt/rooms"), "/cbt/login");
  assert.equal(loginPathForTarget("/cbt/rooms/cbtroom_123"), "/cbt/login");
  assert.equal(loginPathForTarget("/cbt/questions"), "/cbt/login");
  // The OTP page itself must never self-redirect.
  assert.equal(loginPathForTarget("/cbt/login"), "/auth");
  // Everything else keeps the main password login.
  assert.equal(loginPathForTarget("/teacher"), "/auth");
  assert.equal(loginPathForTarget("/dashboard"), "/auth");
  assert.equal(loginPathForTarget("/admin"), "/auth");
  // A path merely containing "cbt" but not under /cbt must not match.
  assert.equal(loginPathForTarget("/cbtx"), "/auth");
});
