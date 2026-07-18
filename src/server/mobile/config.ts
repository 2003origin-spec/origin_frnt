/**
 * Android shell governance config (ANDROID_HYBRID_APP_PLAN.md §5.2).
 *
 * Served by GET /api/mobile/config. The shell fetches it on cold start and
 * on resume (throttled), caches the last-good copy, and fails open within
 * `offlineGraceDays` when unreachable.
 *
 * Values are environment-driven: flipping one is a Vercel env edit +
 * redeploy (minutes), which is the "remote config" lever for kill-switching
 * features or forcing shell updates without a Play release. Defaults are the
 * safe/dark posture: nothing forced, link-out OFF (Play India anti-steering,
 * plan §10.2), SW on, native Google login on.
 */

export type MobileConfig = {
  minSupportedVersionCode: number;
  softNudgeVersionCode: number;
  killSwitch: boolean;
  serviceWorkerEnabled: boolean;
  linkOutEnabled: boolean;
  googleNativeLoginEnabled: boolean;
  offlineGraceDays: number;
  webviewFloor: number;
  /** Server clock, ISO — clients use it for skew estimation, never trust local time. */
  serverTime: string;
  flags: Record<string, boolean>;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function buildMobileConfig(): MobileConfig {
  return {
    minSupportedVersionCode: envInt("MOBILE_MIN_SUPPORTED_VERSION_CODE", 0),
    softNudgeVersionCode: envInt("MOBILE_SOFT_NUDGE_VERSION_CODE", 0),
    killSwitch: envBool("MOBILE_KILL_SWITCH", false),
    serviceWorkerEnabled: envBool("MOBILE_SERVICE_WORKER_ENABLED", true),
    linkOutEnabled: envBool("MOBILE_LINK_OUT_ENABLED", false),
    googleNativeLoginEnabled: envBool("MOBILE_GOOGLE_NATIVE_LOGIN_ENABLED", true),
    offlineGraceDays: envInt("MOBILE_OFFLINE_GRACE_DAYS", 7),
    webviewFloor: envInt("MOBILE_WEBVIEW_FLOOR", 111),
    serverTime: new Date().toISOString(),
    flags: {},
  };
}
