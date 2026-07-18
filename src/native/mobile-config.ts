/**
 * Client-side reader for GET /api/mobile/config (plan §5.2). Module-cached —
 * the config is CDN-cached for 60 s server-side and nothing consuming it
 * needs fresher data within a page lifetime.
 */

export type MobileClientConfig = {
  linkOutEnabled: boolean;
  googleNativeLoginEnabled: boolean;
  serviceWorkerEnabled: boolean;
  serverTime: string | null;
};

const FALLBACK: MobileClientConfig = {
  // Fail closed on the policy-sensitive flag (purchase link-out) and open on
  // the harmless ones.
  linkOutEnabled: false,
  googleNativeLoginEnabled: true,
  serviceWorkerEnabled: true,
  serverTime: null,
};

let configPromise: Promise<MobileClientConfig> | null = null;

export function fetchMobileConfig(): Promise<MobileClientConfig> {
  if (!configPromise) {
    configPromise = (async () => {
      try {
        const response = await fetch("/api/mobile/config");
        if (!response.ok) return FALLBACK;
        const body = (await response.json()) as Record<string, unknown>;
        return {
          linkOutEnabled: body.linkOutEnabled === true,
          googleNativeLoginEnabled: body.googleNativeLoginEnabled !== false,
          serviceWorkerEnabled: body.serviceWorkerEnabled !== false,
          serverTime: typeof body.serverTime === "string" ? body.serverTime : null,
        };
      } catch {
        return FALLBACK;
      }
    })();
  }
  return configPromise;
}
