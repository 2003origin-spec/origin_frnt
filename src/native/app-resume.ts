/**
 * App-resume notifications for long-lived surfaces (SSE rooms, entitlement
 * refetch). Android Doze / background throttling kills EventSource streams
 * and timers while the app is backgrounded; subscribers use this to
 * reconnect the moment the user returns (plan §5.7 / ledger #39).
 *
 * Two sources, deduped:
 *  - Capacitor App plugin `resume` event (native truth, app context only)
 *  - `visibilitychange` → visible (works in browsers AND the WebView)
 *
 * Both can fire for one resume, so callbacks are suppressed inside a short
 * window after the last delivery.
 */

const DEDUPE_WINDOW_MS = 1_000;

type ResumeCallback = () => void;

export function subscribeAppResume(callback: ResumeCallback): () => void {
  if (typeof window === "undefined") return () => {};

  let disposed = false;
  let lastFiredAt = 0;

  const fire = () => {
    if (disposed) return;
    const now = Date.now();
    if (now - lastFiredAt < DEDUPE_WINDOW_MS) return;
    lastFiredAt = now;
    callback();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") fire();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Native resume listener — attach best-effort; addListener may return a
  // promise (Capacitor 5+) or a handle, and may not exist at all.
  let nativeHandle: { remove: () => Promise<void> } | null = null;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin?.addListener) {
    try {
      const result = appPlugin.addListener("resume", fire);
      Promise.resolve(result)
        .then((handle) => {
          if (disposed) void handle.remove();
          else nativeHandle = handle;
        })
        .catch(() => {});
    } catch {
      // visibilitychange fallback still covers us.
    }
  }

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibility);
    if (nativeHandle) void nativeHandle.remove();
  };
}
