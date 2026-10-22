/**
 * Android hardware Back / edge-swipe interception for the Capacitor shell.
 *
 * With no JS listener, the stock @capacitor/app plugin calls
 * `webView.goBack()`, which the App Router treats as a soft navigation: no
 * `beforeunload`, the page just unmounts. Registering a `backButton` listener
 * disables that default, so a surface (an exam in progress) can ask first.
 *
 * Returns an unsubscribe function. A no-op in browsers and in shells without
 * the App plugin; callers keep a `popstate` guard for those.
 */

type BackCallback = () => void;

export function subscribeNativeBackButton(callback: BackCallback): () => void {
  if (typeof window === "undefined") return () => {};
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return () => {};

  let disposed = false;
  let handle: { remove: () => Promise<void> } | null = null;
  try {
    const result = appPlugin.addListener("backButton", () => {
      if (!disposed) callback();
    });
    Promise.resolve(result)
      .then((h) => {
        if (disposed) void h.remove().catch(() => {});
        else handle = h;
      })
      .catch(() => {});
  } catch {
    return () => {};
  }

  return () => {
    disposed = true;
    if (handle) void handle.remove().catch(() => {});
  };
}
