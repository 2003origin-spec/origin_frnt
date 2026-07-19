/**
 * Ambient typings for the Capacitor bridge injected by the Android shell
 * (V1/mobile-android). The web bundle deliberately has NO Capacitor npm
 * dependency: the shell loads this site remotely (`server.url` mode) and
 * injects `window.Capacitor` with natively-registered plugins on
 * `Capacitor.Plugins`. Everything here must therefore be feature-detected —
 * old shells live in the wild for months after a web deploy, so the web app
 * may only call a bridge method after confirming it via `getCapabilities()`
 * (see ANDROID_HYBRID_APP_PLAN.md §7).
 */

/** Feature strings advertised by the shell's OriginNative.getCapabilities(). */
export type NativeCapability =
  | "saveFile"
  | "secureScreen"
  | "keepAwake"
  | "flushCookies"
  | "googleSignIn"
  | "deviceClass"
  | "linkOut"
  | "pushTokens"
  | "offlineReady";

export type OriginNativeCapabilities = {
  /** Bridge contract major version. 1 = initial shell. */
  bridge: number;
  features: NativeCapability[];
  /** Android versionCode of the installed shell (mirrors the UA suffix). */
  versionCode: number;
};

export type NativeDeviceClass = "low" | "mid" | "high";

/** Custom plugin implemented in V1/mobile-android (OriginNativePlugin.kt). */
export type OriginNativePlugin = {
  getCapabilities(): Promise<OriginNativeCapabilities>;
  getDeviceClass(): Promise<{ deviceClass: NativeDeviceClass }>;
  saveFile(options: { name: string; mime: string; base64: string }): Promise<{ uri: string }>;
  flushCookies(): Promise<void>;
  setSecureScreen(options: { on: boolean }): Promise<void>;
  setKeepAwake(options: { on: boolean }): Promise<void>;
  openLinkOut(options: { url: string }): Promise<void>;
  /** Credential Manager sign-in; resolves with a Google ID token whose `aud`
   * is NEXT_PUBLIC_GOOGLE_CLIENT_ID (the shell passes it as serverClientId). */
  googleSignIn(): Promise<{ idToken: string | null }>;
  getPushToken(): Promise<{ token: string | null }>;
  onLogout(): Promise<void>;
  /** Web → shell: whether the service worker is active with the offline
   * shell precached; feeds the shell's cold-start offline gate (§8.1). */
  setOfflineReady(options: { ready: boolean }): Promise<void>;
};

type PluginListenerHandle = { remove: () => Promise<void> };

/** Subset of the stock @capacitor/app plugin surface we rely on. */
type CapacitorAppPlugin = {
  addListener(
    event: "resume" | "pause" | "backButton" | "appUrlOpen",
    callback: (data?: unknown) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
};

export type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    OriginNative?: OriginNativePlugin;
    App?: CapacitorAppPlugin;
    [key: string]: unknown;
  };
};

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}
