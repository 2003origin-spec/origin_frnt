/**
 * Page-side service-worker lifecycle helpers (ANDROID_HYBRID_APP_PLAN.md §6).
 *
 * Used by ServiceWorkerManager (register/unregister + deploy-skew recovery)
 * and AuthContext.logout (runtime-cache purge on shared devices — ledger
 * #18). Everything is best-effort: offline UX must never break auth or
 * navigation, so failures resolve silently.
 */

import { LOGOUT_PURGE_CACHE_PREFIX } from "@/sw/policy";

export const SW_SCRIPT_URL = "/sw.js";

export function swSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && window.isSecureContext;
}

export async function registerOriginSw(): Promise<ServiceWorkerRegistration | null> {
  if (!swSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_SCRIPT_URL, { scope: "/" });
  } catch {
    return null;
  }
}

async function deleteCachesByPrefix(prefixes: readonly string[]): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => prefixes.some((prefix) => name.startsWith(prefix)))
      .map((name) => caches.delete(name)),
  );
}

/**
 * Remote kill switch (§6.6): unregister every worker on this origin and drop
 * ALL our caches (runtime + precache). The recovery path for a cache-logic
 * bug bricking clients — must always leave the site in plain-network state.
 */
export async function unregisterOriginSw(): Promise<void> {
  if (!swSupported()) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    await deleteCachesByPrefix(["origin-"]);
  } catch {
    // Best-effort — a failed unregister retries on the next page load.
  }
}

/**
 * Logout hygiene (§6.5, ledger #18 — shared devices are the norm for our
 * audience): wipe runtime caches (cached pages/RSC hold the user's data) and
 * IndexedDB. The precache survives — it only holds the neutral offline
 * shell. Time-boxed so a slow storage layer can never stall the logout
 * redirect.
 */
export async function purgeUserCachesForLogout(): Promise<void> {
  if (typeof window === "undefined") return;
  const purge = (async () => {
    await deleteCachesByPrefix([LOGOUT_PURGE_CACHE_PREFIX]);
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((info) => info.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = request.onerror = request.onblocked = () => resolve();
              }),
          ),
      );
    }
  })();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  await Promise.race([purge, timeout]).catch(() => {});
}

/**
 * Deploy-skew detection (§6.4, ledger #7): a Vercel deploy mid-session makes
 * old content-hashed chunks 404, surfacing as ChunkLoadError (webpack name,
 * still thrown by Next) or a failed dynamic import. Matched loosely — the
 * message shape differs across browsers.
 */
export function isChunkLoadError(candidate: unknown): boolean {
  const inspect = (value: unknown): boolean => {
    if (typeof value === "string") {
      return (
        /ChunkLoadError/iu.test(value) ||
        /Loading chunk [\w-]+ failed/iu.test(value) ||
        /Failed to fetch dynamically imported module/iu.test(value) ||
        /error loading dynamically imported module/iu.test(value)
      );
    }
    if (value instanceof Error) {
      return value.name === "ChunkLoadError" || inspect(value.message);
    }
    return false;
  };
  if (inspect(candidate)) return true;
  if (candidate && typeof candidate === "object" && "reason" in candidate) {
    return inspect((candidate as { reason: unknown }).reason);
  }
  return false;
}

const RELOAD_GUARD_KEY = "origin-sw-skew-reload-at";
const RELOAD_GUARD_WINDOW_MS = 30_000;

/**
 * At most one automatic skew-recovery reload per 30 s window — if the reload
 * didn't fix the chunk 404s, looping on it would just strobe the page.
 */
export function claimSkewReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    // Storage unavailable (private mode edge cases): reload once, unguarded.
    return true;
  }
}
