"use client";

/**
 * Registers and supervises the offline service worker for EVERY user —
 * browsers get faster repeat loads, the Android shell gets its offline layer
 * (ANDROID_HYBRID_APP_PLAN.md §6). Mounted once from the root layout;
 * renders nothing.
 *
 * Responsibilities:
 *  - register /sw.js (production builds; dev only via NEXT_PUBLIC_SW_DEV=1)
 *  - remote kill switch (§6.6): serviceWorkerEnabled=false in
 *    /api/mobile/config → unregister + purge all caches on next load
 *  - deploy-skew recovery (§6.4, ledger #7): ChunkLoadError / stale-chunk
 *    404 → toast → one guarded reload
 *  - tell the Android shell whether the offline layer is primed, so its
 *    cold-start gate knows an offline launch can still render (ledger #1/#2)
 *  - ask for durable storage in the app (§6.5)
 */

import { useEffect } from "react";
import { toast } from "sonner";

import { isNativeApp } from "@/native/is-native-app";
import { reportOfflineReady } from "@/native/bridge";
import { fetchMobileConfig } from "@/native/mobile-config";
import { SW_MESSAGE } from "@/sw/policy";
import {
  claimSkewReload,
  isChunkLoadError,
  registerOriginSw,
  swSupported,
  unregisterOriginSw,
} from "@/sw/client";

const SW_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_SW_ENABLED !== "0" &&
  (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1");

function recoverFromStaleDeploy(): void {
  if (!claimSkewReload()) return;
  toast.info("App updated — refreshing…", { duration: 1_500 });
  // Give the toast a beat to paint; the reload fetches the new deploy's
  // chunks (and, in the worker, drops the dead cached ones via NetworkFirst).
  window.setTimeout(() => window.location.reload(), 900);
}

export default function ServiceWorkerManager() {
  useEffect(() => {
    if (!swSupported()) return;

    let disposed = false;

    const onWindowError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) recoverFromStaleDeploy();
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) recoverFromStaleDeploy();
    };
    const onSwMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === SW_MESSAGE.staleDeploy) {
        recoverFromStaleDeploy();
      }
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    void (async () => {
      const config = await fetchMobileConfig();
      if (disposed) return;

      if (!SW_BUILD_ENABLED || !config.serviceWorkerEnabled) {
        // Kill switch / build opt-out: leave the origin in plain-network
        // state and tell the shell offline launches can no longer render.
        await unregisterOriginSw();
        void reportOfflineReady(false);
        return;
      }

      const registration = await registerOriginSw();
      if (!registration || disposed) return;

      // `ready` resolves once a worker is active; install precached
      // /offline.html before that, so active ⇒ an offline launch has a page.
      await navigator.serviceWorker.ready;
      if (disposed) return;
      void reportOfflineReady(true);

      if (isNativeApp()) {
        // Keep the offline layer out of storage-pressure eviction (§6.5).
        void navigator.storage?.persist?.().catch(() => {});

        // Android WebView never routes the FIRST navigation after process
        // start through the service worker, so a cold-started page sits
        // uncontrolled for its whole session and none of its traffic
        // refreshes the offline caches. One early reload (per WebView
        // process — sessionStorage dies with it) puts the session under SW
        // control; the shell's launch overlay hides the flash. First-ever
        // install is exempt: clientsClaim already controls that page.
        const reloadGuardKey = "origin-sw-claim-reload";
        if (
          !navigator.serviceWorker.controller &&
          registration.active &&
          !sessionStorage.getItem(reloadGuardKey)
        ) {
          try {
            sessionStorage.setItem(reloadGuardKey, "1");
            window.location.reload();
          } catch {
            // Storage unavailable: skip rather than risk a reload loop.
          }
        }
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, []);

  return null;
}
