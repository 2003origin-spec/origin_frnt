/**
 * Memoised native capability handshake that never memoises a miss.
 *
 * The shell injects `window.Capacitor` from its WebViewClient, and on older
 * WebViews without document-start injection the first caller can run before
 * the plugin exists. Caching that `null` turned FLAG_SECURE, keep-awake and
 * native Google sign-in off until a full reload. Now a missing bridge is
 * waited for briefly, and a miss (absent plugin or failed call) is not cached,
 * so the next caller asks again. Only a real answer is kept.
 *
 * The wait itself is paid once per page load: after a call has waited the
 * full window without the plugin appearing (an older shell that ships no
 * OriginNative), later calls only check for it synchronously and return null
 * at once instead of each polling for another `waitMs`. A plugin that does
 * turn up later is still picked up by the next call.
 *
 * Pure: the environment is injected so it can be tested without a WebView.
 */

export type CapabilityCacheDeps<C> = {
  isNative: () => boolean;
  /** The injected plugin's handshake, or null while it is not there yet. */
  getHandshake: () => (() => Promise<C>) | null;
  sleep: (ms: number) => Promise<void>;
  /** How long to wait for the bridge to appear before giving up this call. */
  waitMs?: number;
  pollMs?: number;
};

export function createCapabilityCache<C>(deps: CapabilityCacheDeps<C>): () => Promise<C | null> {
  const waitMs = deps.waitMs ?? 3_000;
  const pollMs = deps.pollMs ?? 100;
  let resolved: Promise<C | null> | null = null;
  let inFlight: Promise<C | null> | null = null;
  /** Set once a call has waited the whole window and no plugin appeared. */
  let pluginWaitExhausted = false;

  const attempt = async (): Promise<C | null> => {
    if (!deps.isNative()) return null;
    let handshake = deps.getHandshake();
    const budget = pluginWaitExhausted ? 0 : waitMs;
    for (let waited = 0; !handshake && waited < budget; waited += pollMs) {
      await deps.sleep(pollMs);
      handshake = deps.getHandshake();
    }
    if (!handshake) {
      pluginWaitExhausted = true;
      return null;
    }
    return (await handshake()) ?? null;
  };

  return () => {
    if (resolved) return resolved;
    if (inFlight) return inFlight;
    inFlight = attempt()
      .then((caps) => {
        // A browser never becomes native, so its null is final. Inside the
        // shell only a real answer is final.
        if (caps !== null || !deps.isNative()) resolved = Promise.resolve(caps);
        return caps;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
