export type UserRole = "student" | "teacher" | "admin" | "cbt_teacher";

export type RoutePolicy =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "role"; roles: UserRole[] }
  | { kind: "internal"; tokenName: "INTERNAL_CRON_TOKEN" }
  | { kind: "membership" }
  | { kind: "unconfigured" };

export const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/users/login",
  "/api/users/register",
  "/api/users/google-login",
  "/api/users/token/refresh",
  // Phase 13 drain receiver — auth is HMAC body signature (verified in
  // handler), not a bearer token, so this path is excluded from the
  // INTERNAL_CRON_TOKEN policy applied to /api/internal/*.
  "/api/internal/observability/drain",
  // Premium subscriptions webhook — Razorpay signs the body with an HMAC
  // (verified in handler via x-razorpay-signature); there is no session
  // cookie or bearer token, so it is public at the edge.
  "/api/subscriptions/webhook",
  // Connect (Flow-2 batch tuition) webhook — same Razorpay HMAC model as the
  // subscriptions webhook; public at the edge, verified in the handler.
  "/api/connect/webhook",
  // Landing-page public data — no auth required; rate-limited by Upstash in handler.
  "/api/public/live-stats",
  "/api/public/activity-feed",
  "/api/public/demo-solve",
] as const;

export const INTERNAL_API_PREFIXES = ["/api/internal"] as const;

export const AUTHENTICATED_API_PREFIXES = [
  "/api/assessments",
  "/api/interaction",
  "/api/origin-ai",
  "/api/study",
  "/api/users",
  "/api/study-rooms",
  "/api/teacher",
  "/api/enrollments",
  "/api/study-materials",
  "/api/admin",
  "/api/marketplace",
  "/api/subscriptions",
  "/api/connect",
  "/api/social",
] as const;

export const MEMBERSHIP_API_PREFIXES = ["/api/study-rooms/[id]"] as const;

// CBT student surface: public at the edge, gated in-handler by a signed
// room-bound participant JWT. Checked before role/authenticated prefixes.
export const PUBLIC_API_PREFIXES = ["/api/cbt-student"] as const;

// CBT teacher surface: role-gated to cbt_teacher. Checked before the
// authenticated prefixes (there is no `authenticated` policy on any CBT
// surface — that is what enforces the mutual-lockout invariant).
export const ROLE_API_PREFIXES = [
  { prefix: "/api/cbt", roles: ["cbt_teacher"] as UserRole[] },
] as const;

export const PUBLIC_APP_PATHS = [
  "/",
  "/auth",
  "/auth/refresh",
  "/role-selection",
  "/explore",
  "/premium",
  "/terms-and-conditions",
  "/privacy-policy",
  "/childrens-policy",
  "/faq",
  // CBT teacher OTP login page — public so allowlisted teachers can reach it.
  "/cbt/login",
] as const;

// `/cbt/r` = student join/test pages, public at the edge (participant-token
// gated in-handler). Public is checked before the `/cbt` role prefix, so the
// student surface stays reachable under the role-gated `/cbt` tree.
export const PUBLIC_APP_PREFIXES = ["/videos", "/cbt/r"] as const;

export const AUTHENTICATED_APP_PREFIXES = [
  "/dashboard",
  "/tests",
  "/ogcode",
  "/leaderboard",
  "/milestones",
  "/profile",
  "/study-corner",
  "/study-rooms",
  "/tasks",
  "/pomodoro",
  "/dpp",
  "/doubt-solver",
  "/onboarding",
  "/books",
  "/teacher",
  "/marketplace",
  "/connect",
  "/u",
  "/social",
] as const;

export const ROLE_APP_PREFIXES = [
  { prefix: "/admin", roles: ["admin"] as UserRole[] },
  { prefix: "/cbt", roles: ["cbt_teacher"] as UserRole[] },
] as const;

export function normalizePathname(pathname: string): string {
  return pathname === "/" ? pathname : pathname.replace(/\/+$/u, "");
}

/**
 * The login page an unauthenticated user should be sent to for a protected app
 * path. CBT teachers authenticate via the OTP page (/cbt/login), never the main
 * password form (/auth) — they have no password and handleLogin rejects the
 * cbt_teacher role. Everything else uses /auth.
 */
export function loginPathForTarget(pathname: string): string {
  if (pathname === "/cbt/login") return "/auth"; // public in practice; never self-redirect
  return pathname === "/cbt" || pathname.startsWith("/cbt/") ? "/cbt/login" : "/auth";
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRoomScopedApi(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "api" && parts[1] === "study-rooms" && Boolean(parts[2]);
}

export function getApiRoutePolicy(rawPathname: string): RoutePolicy {
  const pathname = normalizePathname(rawPathname);
  if (!pathname.startsWith("/api/")) {
    return { kind: "unconfigured" };
  }
  if ((PUBLIC_API_PATHS as readonly string[]).includes(pathname)) {
    return { kind: "public" };
  }
  if (INTERNAL_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "internal", tokenName: "INTERNAL_CRON_TOKEN" };
  }
  if (PUBLIC_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "public" };
  }
  if (isRoomScopedApi(pathname)) {
    return { kind: "membership" };
  }
  for (const entry of ROLE_API_PREFIXES) {
    if (pathMatchesPrefix(pathname, entry.prefix)) {
      return { kind: "role", roles: [...entry.roles] };
    }
  }
  if (AUTHENTICATED_API_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "authenticated" };
  }
  return { kind: "unconfigured" };
}

export function getAppRoutePolicy(rawPathname: string): RoutePolicy {
  const pathname = normalizePathname(rawPathname);
  if (pathname.startsWith("/api/")) {
    return getApiRoutePolicy(pathname);
  }
  if ((PUBLIC_APP_PATHS as readonly string[]).includes(pathname)) {
    return { kind: "public" };
  }
  if (PUBLIC_APP_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "public" };
  }
  for (const entry of ROLE_APP_PREFIXES) {
    if (pathMatchesPrefix(pathname, entry.prefix)) {
      return { kind: "role", roles: [...entry.roles] };
    }
  }
  if (AUTHENTICATED_APP_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { kind: "authenticated" };
  }
  return { kind: "unconfigured" };
}

export function isKnownApiRouteFile(routeFile: string): boolean {
  const normalized = routeFile.replace(/\\/g, "/");
  const marker = "/src/app/api/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1 || !normalized.endsWith("/route.ts")) {
    return false;
  }

  const routePattern = `/api/${normalized
    .slice(markerIndex + marker.length, -"/route.ts".length)
    .replace(/\/\[\.\.\.slug\]$/u, "")
    .replace(/\/\[id\](?=\/|$)/u, "/[id]")}`;

  if (routePattern === "/api/users") return true;
  if (routePattern === "/api/study-rooms") return true;
  if (routePattern.startsWith("/api/study-rooms/[id]")) return true;
  if (routePattern.startsWith("/api/internal")) return true;

  return getApiRoutePolicy(routePattern).kind !== "unconfigured";
}

export function isKnownAppPageFile(pageFile: string): boolean {
  const normalized = pageFile.replace(/\\/g, "/");
  const marker = "/src/app/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1 || !normalized.endsWith("/page.tsx")) {
    return false;
  }
  const routePattern =
    "/" +
    normalized
      .slice(markerIndex + marker.length, -"/page.tsx".length)
      .replace(/\/\[id\]/gu, "/[id]")
      .replace(/\/\[\.\.\.[^\]]+\]/gu, "");
  return getAppRoutePolicy(routePattern === "/" ? "/" : routePattern).kind !== "unconfigured";
}
