/**
 * Native push registration (Phase E; first used by Origin NOW offer alerts,
 * decision B88). Inside the Android app the shell hands out its FCM token
 * through OriginNative.getPushToken; the server keeps it in
 * notif.device_tokens via /api/mobile/push-tokens. In a browser, or in a
 * shell without Firebase, every helper here resolves to "unavailable".
 */

import { getOriginNative, hasNativeCapability } from "@/native/bridge";
import { apiCall } from "@/lib/api";

export type NativePushResult =
  | { state: "on"; token: string }
  | { state: "blocked" }
  | { state: "unavailable" };

/** True when this is the Android app and its shell can hand out push tokens. */
export async function canUseNativePush(): Promise<boolean> {
  return hasNativeCapability("pushTokens");
}

/**
 * Asks the shell for the token (Android 13+ shows the permission prompt) and
 * registers it for the signed-in user. "blocked" when the user said no.
 */
export async function enableNativePush(): Promise<NativePushResult> {
  if (!(await canUseNativePush())) return { state: "unavailable" };
  const plugin = getOriginNative();
  if (!plugin) return { state: "unavailable" };
  const { token, notifications } = await plugin.getPushToken();
  if (!token) return { state: "unavailable" };
  if (notifications === "denied") return { state: "blocked" };
  await apiCall("/mobile/push-tokens", { method: "POST", body: JSON.stringify({ token, platform: "android" }) });
  return { state: "on", token };
}

/** Stops pushes to this device for the signed-in user. Best effort. */
export async function disableNativePush(): Promise<void> {
  if (!(await canUseNativePush())) return;
  const plugin = getOriginNative();
  if (!plugin) return;
  try {
    const { token } = await plugin.getPushToken();
    if (token) await apiCall("/mobile/push-tokens", { method: "DELETE", body: JSON.stringify({ token }) });
  } catch {
    // The server prunes tokens FCM reports dead.
  }
}
