/**
 * Safe accessors for the shell's OriginNative plugin.
 *
 * Contract rule (ANDROID_HYBRID_APP_PLAN.md §7.3): the web app may only call
 * a bridge method after `hasNativeCapability()` confirms it. Old shells stay
 * installed long after web deploys, so every call site must tolerate an
 * absent or older bridge. All helpers here resolve to null/false instead of
 * throwing when the bridge (or a capability) is missing.
 */

import { isNativeApp } from "@/native/is-native-app";
import type { NativeCapability, OriginNativeCapabilities, OriginNativePlugin } from "@/native/types";

export function getOriginNative(): OriginNativePlugin | null {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.OriginNative ?? null;
}

let capabilitiesPromise: Promise<OriginNativeCapabilities | null> | null = null;

/** Memoized capability handshake. Null in browsers or when the call fails. */
export function getNativeCapabilities(): Promise<OriginNativeCapabilities | null> {
  if (!capabilitiesPromise) {
    capabilitiesPromise = (async () => {
      if (!isNativeApp()) return null;
      const plugin = getOriginNative();
      if (!plugin) return null;
      try {
        return await plugin.getCapabilities();
      } catch {
        return null;
      }
    })();
  }
  return capabilitiesPromise;
}

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

/** Native-side logout cleanup (push token invalidation etc.). Best-effort. */
export async function notifyNativeLogout(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await getOriginNative()?.onLogout();
  } catch {
    // Old shells without onLogout: server-side pruning covers us.
  }
}
