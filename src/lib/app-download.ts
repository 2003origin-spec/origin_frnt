/**
 * "Get the app" (SEO_APP_DOWNLOAD_NOTES.md): which device is this, and what
 * the nav button does there. Pure, so the decision is unit-tested.
 *
 * - android  → open the Play Store listing straight away
 * - ios      → "iOS app coming soon", with the Play link to copy or share
 * - desktop  → small dialog with the Android link and "iOS: coming soon"
 * - in-app   → already inside our Android app: hide the button
 */

/** Checked live on 11/11/2026: 200, "Origin – Apps on Google Play". */
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.o3origin.app";

export type AppDevice = "android" | "ios" | "desktop" | "in-app";

export type DeviceSignals = {
  userAgent: string;
  /** navigator.maxTouchPoints: iPadOS 13+ reports a Mac user agent but has touch. */
  maxTouchPoints?: number;
  /** isNativeApp() from src/native (Capacitor bridge or OriginApp/ UA). */
  nativeShell?: boolean;
};

const IN_APP_UA = /\bOriginApp\/\d+/u;
const IOS_UA = /\b(iPhone|iPad|iPod)\b/u;
const ANDROID_UA = /\bAndroid\b/u;
const MAC_UA = /\bMacintosh\b/u;

export function detectAppDevice({ userAgent, maxTouchPoints = 0, nativeShell = false }: DeviceSignals): AppDevice {
  const ua = userAgent ?? "";
  if (nativeShell || IN_APP_UA.test(ua)) return "in-app";
  if (IOS_UA.test(ua)) return "ios";
  if (ANDROID_UA.test(ua)) return "android";
  // iPadOS 13+ asks for the desktop site and reports "Macintosh"; real Macs have no touch points.
  if (MAC_UA.test(ua) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

export type AppDownloadAction = "play_store" | "ios_sheet" | "desktop_sheet" | "hidden";

export function appDownloadAction(device: AppDevice): AppDownloadAction {
  switch (device) {
    case "android":
      return "play_store";
    case "ios":
      return "ios_sheet";
    case "in-app":
      return "hidden";
    default:
      return "desktop_sheet";
  }
}
