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

import { isFeatureEnabled } from "@/lib/feature-flags";

type FlagKey = Parameters<typeof isFeatureEnabled>[0];

export type MobileConfig = {
  minSupportedVersionCode: number;
  softNudgeVersionCode: number;
  killSwitch: boolean;
  serviceWorkerEnabled: boolean;
  linkOutEnabled: boolean;
  googleNativeLoginEnabled: boolean;
  /** Teacher accounts may sign in (Student / Teacher choice on the sign-in screen). */
  teacherLoginEnabled: boolean;
  /**
   * Web OAuth client id the native app passes to Credential Manager as
   * serverClientId, so the ID token's `aud` is the one handleGoogleLogin
   * verifies. Public by design (NEXT_PUBLIC_*). Empty when unset: the app
   * then hides its Google button.
   */
  googleWebClientId: string;
  offlineGraceDays: number;
  webviewFloor: number;
  /** Server clock, ISO — clients use it for skew estimation, never trust local time. */
  serverTime: string;
  flags: Record<string, boolean>;
  /**
   * Launcher icon the app should show (/admin/app-icon), added by the route from the
   * platform settings; null = leave the app's icon alone (also when the database is down).
   */
  appIcon?: string | null;
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

/**
 * Student-facing feature switches the native app needs to hide surfaces that
 * are off (V1/NATIVE_APP_API_PLAN.md §1.5). An allowlist on purpose: this
 * response is public and CDN-cached, so admin/teacher/internal flags stay out.
 */
const APP_FLAG_KEYS = [
  "contest",
  "payments",
  "originNow",
  "loginStreakCelebration",
  "liveRooms",
  "studentSocial",
  "teacherConnect",
  "batchHub",
  "studyMaterials",
  "premiumSubscriptions",
  "studyModes",
  "fullLengthMocks",
  "dppQuestionBank",
  "studentMessaging",
  "rankPredictor",
  "collegeCounselling",
] as const satisfies readonly FlagKey[];

function appFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = Object.fromEntries(APP_FLAG_KEYS.map((key) => [key, isFeatureEnabled(key)]));
  // Messaging also needs Student Social; send the effective value so the app
  // never shows a surface whose every route answers 404.
  flags.studentMessaging = flags.studentMessaging && flags.studentSocial;
  return flags;
}

/** Teachers may sign in to the app (remote switch: MOBILE_TEACHER_ENABLED, on by default). */
export function mobileTeacherEnabled(): boolean {
  return envBool("MOBILE_TEACHER_ENABLED", true);
}

export function buildMobileConfig(): MobileConfig {
  return {
    minSupportedVersionCode: envInt("MOBILE_MIN_SUPPORTED_VERSION_CODE", 0),
    softNudgeVersionCode: envInt("MOBILE_SOFT_NUDGE_VERSION_CODE", 0),
    killSwitch: envBool("MOBILE_KILL_SWITCH", false),
    serviceWorkerEnabled: envBool("MOBILE_SERVICE_WORKER_ENABLED", true),
    linkOutEnabled: envBool("MOBILE_LINK_OUT_ENABLED", false),
    googleNativeLoginEnabled: envBool("MOBILE_GOOGLE_NATIVE_LOGIN_ENABLED", true),
    teacherLoginEnabled: mobileTeacherEnabled(),
    googleWebClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "",
    offlineGraceDays: envInt("MOBILE_OFFLINE_GRACE_DAYS", 7),
    webviewFloor: envInt("MOBILE_WEBVIEW_FLOOR", 111),
    serverTime: new Date().toISOString(),
    flags: appFlags(),
  };
}
