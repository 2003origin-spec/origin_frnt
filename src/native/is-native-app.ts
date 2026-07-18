/**
 * Canonical "am I running inside the Android shell?" detection.
 *
 * Two independent signals (ANDROID_HYBRID_APP_PLAN.md §5.1):
 *  - authoritative: the injected Capacitor bridge (`window.Capacitor`)
 *  - fallback:      the shell's UA suffix `OriginApp/{versionCode} (...)`
 *
 * The UA fallback matters because the bridge is injected by the shell's
 * WebViewClient and a script that runs extremely early could race it. It is
 * also the ONLY signal available server-side. Never make security decisions
 * off either signal — they gate UX, not authorization.
 */

const UA_MARKER = /\bOriginApp\/(\d+)\b/u;

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  return UA_MARKER.test(window.navigator?.userAgent ?? "");
}

/** Shell versionCode parsed from the UA suffix; null in browsers/SSR. */
export function nativeAppVersionCode(): number | null {
  if (typeof window === "undefined") return null;
  return parseAppVersionFromUserAgent(window.navigator?.userAgent ?? "");
}

/**
 * Server/edge-side helper: parse the shell versionCode out of a raw
 * User-Agent header. Returns null for regular browsers.
 */
export function parseAppVersionFromUserAgent(userAgent: string | null | undefined): number | null {
  if (!userAgent) return null;
  const match = UA_MARKER.exec(userAgent);
  if (!match) return null;
  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}
