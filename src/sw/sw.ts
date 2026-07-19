/// <reference lib="webworker" />
/**
 * ORIGIN service worker — offline layer 1 (ANDROID_HYBRID_APP_PLAN.md §6).
 *
 * Hand-rolled on serwist's RUNTIME classes only and compiled to public/sw.js
 * by scripts/build-sw.mjs (esbuild). Deliberately NOT @serwist/next: the app
 * builds with `next build --turbopack`, so the worker is a standalone
 * artifact with manual registration (src/components/pwa/ServiceWorkerManager)
 * — zero webpack-plugin coupling.
 *
 * Strategy table lives in src/sw/policy.ts (unit-tested). Anything policy
 * classifies as `bypass` never matches a route here, so the worker is
 * invisible to APIs, mutations, auth and SSE/AI streams.
 *
 * Remote kill switch (§6.6): /api/mobile/config `serviceWorkerEnabled=false`
 * makes the next page load unregister this worker and purge every cache —
 * handled page-side in ServiceWorkerManager, not here.
 */

import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
  type RouteMatchCallback,
  type SerwistPlugin,
} from "serwist";

import {
  classifyRequest,
  isCacheablePageResponse,
  OFFLINE_FALLBACK_URL,
  SW_CACHE,
  SW_LIMITS,
  SW_MESSAGE,
  type SwRequestClass,
} from "./policy";

declare const self: ServiceWorkerGlobalScope;
/** Injected by scripts/build-sw.mjs — Vercel commit SHA (or a dev stamp).
 * Changes every deploy, which is what makes browsers re-fetch the worker. */
declare const __ORIGIN_SW_BUILD_ID__: string;

const matches =
  (expected: SwRequestClass): RouteMatchCallback =>
  ({ request, url, sameOrigin }) =>
    classifyRequest({
      method: request.method,
      mode: request.mode,
      destination: request.destination,
      pathname: url.pathname,
      sameOrigin,
      hasRscParam: url.searchParams.has("_rsc"),
      hasRscHeader: request.headers.get("rsc") === "1",
    }) === expected;

/** Refuses redirected/auth/non-200 page payloads (src/sw/policy.ts). */
const cacheablePagePlugin: SerwistPlugin = {
  cacheWillUpdate: async ({ request, response }) =>
    isCacheablePageResponse({
      status: response.status,
      redirected: response.redirected,
      pathname: new URL(request.url).pathname,
    })
      ? response
      : null,
};

/** Deploy-skew detector (§6.4): a 404 for a content-hashed static chunk can
 * only mean the deploy moved under this session. Tell every open page — the
 * ServiceWorkerManager toasts "App updated" and reloads once. */
const staleDeployPlugin: SerwistPlugin = {
  fetchDidSucceed: async ({ response }) => {
    if (response.status === 404) {
      void self.clients
        .matchAll({ type: "window" })
        .then((clients) => clients.forEach((client) => client.postMessage({ type: SW_MESSAGE.staleDeploy })));
    }
    return response;
  },
};

const serwist = new Serwist({
  precacheEntries: [{ url: OFFLINE_FALLBACK_URL, revision: __ORIGIN_SW_BUILD_ID__ }],
  precacheOptions: {
    cacheName: SW_CACHE.precache,
    cleanupOutdatedCaches: true,
  },
  // New worker takes over immediately — deploy-skew recovery wants the
  // freshest routing logic controlling every open tab as soon as possible.
  skipWaiting: true,
  clientsClaim: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: matches("static"),
      handler: new CacheFirst({
        cacheName: SW_CACHE.static,
        plugins: [
          staleDeployPlugin,
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ ...SW_LIMITS.static, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      matcher: matches("asset"),
      handler: new StaleWhileRevalidate({
        cacheName: SW_CACHE.assets,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ ...SW_LIMITS.assets, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      matcher: matches("rsc"),
      handler: new NetworkFirst({
        cacheName: SW_CACHE.rsc,
        networkTimeoutSeconds: SW_LIMITS.networkTimeoutSeconds,
        plugins: [
          cacheablePagePlugin,
          new ExpirationPlugin({ ...SW_LIMITS.rsc, maxAgeFrom: "last-used", purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      // "Recently visited pages readable offline" (D2 tier 1, ledger #1/#5).
      matcher: matches("navigation"),
      handler: new NetworkFirst({
        cacheName: SW_CACHE.pages,
        networkTimeoutSeconds: SW_LIMITS.networkTimeoutSeconds,
        plugins: [
          cacheablePagePlugin,
          new ExpirationPlugin({ ...SW_LIMITS.pages, maxAgeFrom: "last-used", purgeOnQuotaError: true }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        // Only full-page navigations fall back to the offline shell. A failed
        // RSC/static fetch must fail — Next then hard-navigates, which lands
        // back here as a navigation and gets the fallback if still offline.
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
