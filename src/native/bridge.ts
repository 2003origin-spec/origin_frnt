/**
 * Safe accessors for the shell's OriginNative plugin.
 *
 * Contract rule (ANDROID_HYBRID_APP_PLAN.md §7.3): the web app may only call
 * a bridge method after `hasNativeCapability()` confirms it. Old shells stay
 * installed long after web deploys, so every call site must tolerate an
 * absent or older bridge. All helpers here resolve to null/false instead of
 * throwing when the bridge (or a capability) is missing.
 */

import { createCapabilityCache } from "@/native/capability-cache";
import { isNativeApp } from "@/native/is-native-app";
import type { NativeCapability, OriginNativeCapabilities, OriginNativePlugin } from "@/native/types";

export function getOriginNative(): OriginNativePlugin | null {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.OriginNative ?? null;
}

/**
 * Capability handshake. Null in browsers, or when the shell's bridge is not
 * injected yet / the call fails; a null inside the shell is not cached, so a
 * call that raced bridge injection is retried by the next caller.
 */
export const getNativeCapabilities: () => Promise<OriginNativeCapabilities | null> =
  createCapabilityCache<OriginNativeCapabilities>({
    isNative: isNativeApp,
    getHandshake: () => {
      const plugin = getOriginNative();
      return plugin ? () => plugin.getCapabilities() : null;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

export async function hasNativeCapability(capability: NativeCapability): Promise<boolean> {
  const capabilities = await getNativeCapabilities();
  return capabilities?.features.includes(capability) ?? false;
}

/**
 * Ask the shell to persist the WebView cookie jar to disk. Called after
 * auth-changing responses so a refresh-token rotation can never be lost to a
 * process kill before Android's lazy cookie flush (plan §5.3 / ledger #14).
 */
export async function flushNativeCookies(): Promise<void> {
  if (!(await hasNativeCapability("flushCookies"))) return;
  try {
    await getOriginNative()?.flushCookies();
  } catch {
    // Best-effort: Android flushes lazily on its own eventually.
  }
}

/**
 * Tell the shell whether the offline layer is primed (service worker active
 * with the offline shell precached). The shell persists this and uses it at
 * cold start to decide between loading the WebView offline (SW will render)
 * and showing its native offline screen (plan §8.1, ledger #1/#2).
 */
export async function reportOfflineReady(ready: boolean): Promise<void> {
  if (!(await hasNativeCapability("offlineReady"))) return;
  try {
    await getOriginNative()?.setOfflineReady({ ready });
  } catch {
    // Best-effort: the shell then falls back to its native offline screen.
  }
}

/** Native-side logout cleanup (push token invalidation etc.). Best-effort. */
export async function notifyNativeLogout(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await getOriginNative()?.onLogout();
  } catch {
    // Old shells without onLogout: server-side pruning covers us.
  }
}
