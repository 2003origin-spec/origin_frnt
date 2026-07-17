'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * In-app navigation depth for this JS session. Incremented by ClientShell on
 * every route change (see `markAppNavigation`). `window.history.length` alone is
 * NOT a safe signal: it counts external pages too, so a student who opened a
 * deep link from WhatsApp/Google would be thrown out of the app by
 * `router.back()`. Depth > 1 guarantees the previous history entry is ours.
 * Resets on hard reload — after a reload we conservatively fall back to the
 * fallback route rather than risk leaving the site.
 */
let appNavDepth = 0;
let lastMarkedPath: string | null = null;

/**
 * Called by ClientShell whenever the pathname changes (including first load).
 * Idempotent per pathname so double-invoked effects (React StrictMode) don't
 * inflate the depth and wrongly enable history.back() on a deep-linked page.
 */
export function markAppNavigation(pathname: string): void {
  if (pathname === lastMarkedPath) return;
  lastMarkedPath = pathname;
  appNavDepth += 1;
}

/**
 * In-app "Back" that returns to the actual previous page — preserving the App
 * Router's client cache and scroll position of that page — instead of always
 * force-navigating to the dashboard.
 *
 * Falls back to `fallback` when the previous history entry is not an in-app
 * page (deep link, fresh tab, hard reload), so the button never dead-ends and
 * never exits the site.
 */
export function useAppBack(fallback: string = '/dashboard'): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== 'undefined' && appNavDepth > 1 && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}
