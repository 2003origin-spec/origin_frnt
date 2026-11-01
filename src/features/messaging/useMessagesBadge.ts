'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { fetchInbox, MESSAGES_CHANGED_EVENT } from './client';
import { badgeCount } from './messaging-ui';

const POLL_MS = 60_000;
/** Route changes refresh at most this often, so fast clicking stays one call. */
const MIN_GAP_MS = 5_000;

/**
 * Unread messages + waiting requests for the nav badge. Light polling: on route
 * change (throttled), every 60 s while the tab is visible, when the tab comes
 * back, and when a messages screen announces a change. Off → always 0, no calls.
 */
export function useMessagesBadge(enabled: boolean): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const lastRef = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled || inFlight.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (!force && now - lastRef.current < MIN_GAP_MS) return;
      lastRef.current = now;
      inFlight.current = true;
      try {
        const res = await fetchInbox('inbox');
        // A refusal (flag off, kill-switch, signed out) hides the badge.
        setCount(res.ok ? badgeCount(res.data.conversations ?? [], res.data.requestCount ?? 0) : 0);
      } finally {
        inFlight.current = false;
      }
    },
    [enabled],
  );

  useEffect(() => {
    // Defer out of the effect body; the fetch's setState lands asynchronously.
    const t = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(t);
  }, [pathname, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => void refresh(true), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onChanged = () => void refresh(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    };
  }, [enabled, refresh]);

  return enabled ? count : 0;
}
