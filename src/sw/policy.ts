/**
 * Service-worker request policy (ANDROID_HYBRID_APP_PLAN.md §6.2).
 *
 * Pure decision functions shared by the worker entry (src/sw/sw.ts, compiled
 * to public/sw.js by scripts/build-sw.mjs) and the unit tests. Nothing here
 * may touch worker/browser globals — inputs are plain scalars so the rules
 * stay testable under node:test.
 *
 * The cardinal rule: the worker only ever HANDLES the four read-only classes
 * below. Everything else — every /api request, every non-GET, every
 * cross-origin fetch, SSE/AI streams — is `bypass`, meaning no route matches
 * and the request goes straight to the network untouched (never buffered,
 * never cached).
 */

export type SwRequestClass =
  /** `/_next/static/**` — content-hashed, immutable by contract. CacheFirst. */
  | "static"
  /** Same-origin images/fonts + `/_next/image` optimizer output. SWR. */
  | "asset"
  /** Full-page navigations. NetworkFirst → cache → /offline.html. */
  | "navigation"
  /** App Router RSC payload fetches (client nav / prefetch). NetworkFirst. */
  | "rsc"
  /** Everything else: untouched by the service worker. */
  | "bypass";

export type ClassifiableRequest = {
  method: string;
  /** Request.mode — "navigate" for full-page navigations. */
  mode: string;
  /** Request.destination — "image", "font", "document", "" … */
  destination: string;
  /** URL pathname (same-origin requests only carry meaning here). */
  pathname: string;
  /** True when the request URL origin equals the page origin. */
  sameOrigin: boolean;
  /** True when the URL has the `_rsc` search param (router prefetch). */
  hasRscParam: boolean;
  /** True when the `rsc` request header is set (soft navigation fetch). */
  hasRscHeader: boolean;
};

export function classifyRequest(request: ClassifiableRequest): SwRequestClass {
  if (request.method.toUpperCase() !== "GET") return "bypass";
  if (!request.sameOrigin) return "bypass";
  // All API traffic bypasses the worker: auth, mutations, and — critically —
  // SSE/AI streams (CBT rooms, study rooms) which must never be buffered.
  if (request.pathname.startsWith("/api/")) return "bypass";

  if (request.mode === "navigate") return "navigation";
  if (request.pathname.startsWith("/_next/static/")) return "static";
  if (request.pathname.startsWith("/_next/image")) return "asset";
  if (request.destination === "image" || request.destination === "font") return "asset";
  if (request.hasRscParam || request.hasRscHeader) return "rsc";
  return "bypass";
}

/**
 * Page/RSC responses that must never enter a cache:
 *  - redirects (a logged-out /dashboard 307s to /auth — caching the followed
 *    response would poison the /dashboard cache key with /auth content)
 *  - non-200s
 *  - auth surfaces (never cache login/OTP pages — plan §6.5)
 */
const NEVER_CACHE_PAGE_PREFIXES = ["/auth", "/cbt/login", "/account/delete"];

export function isCacheablePageResponse(response: {
  status: number;
  redirected: boolean;
  /** Pathname of the request the response is about to be cached under. */
  pathname: string;
}): boolean {
  if (response.status !== 200) return false;
  if (response.redirected) return false;
  return !NEVER_CACHE_PAGE_PREFIXES.some(
    (prefix) => response.pathname === prefix || response.pathname.startsWith(`${prefix}/`),
  );
}

/** Cache names. Runtime caches survive deploys (that IS the offline layer);
 * the precache is revision-keyed per build via PrecacheEntry.revision. */
export const SW_CACHE = {
  precache: "origin-precache",
  pages: "origin-rt-pages",
  rsc: "origin-rt-rsc",
  static: "origin-rt-static",
  assets: "origin-rt-assets",
} as const;

/** Caches wiped on logout (shared devices — plan ledger #18). The precache
 * stays: it only holds the neutral /offline.html shell. */
export const LOGOUT_PURGE_CACHE_PREFIX = "origin-rt-";

export const OFFLINE_FALLBACK_URL = "/offline.html";

/** postMessage types between worker and pages. */
export const SW_MESSAGE = {
  /** Worker → pages: a hashed /_next/static asset 404'd — the deploy moved
   * under us (plan §6.4); pages toast + reload once. */
  staleDeploy: "ORIGIN_SW_STALE_DEPLOY",
} as const;

export const SW_LIMITS = {
  pages: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
  rsc: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
  static: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 },
  assets: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
  /** NetworkFirst give-up-and-serve-cache timeout (2G/flaky — ledger #6). */
  networkTimeoutSeconds: 3,
} as const;
