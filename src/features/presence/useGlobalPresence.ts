'use client';

import { useEffect } from 'react';

import { heartbeatPresenceAction } from '@/server/actions/presence-actions';

/** Beat a little faster than the 150s server window so a screen stays "active". */
const HEARTBEAT_MS = 50_000;

function screenId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem('presence:screen-id');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('presence:screen-id', id);
    }
    return id;
  } catch {
    return `s_${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Registers this screen in the global "active screens" set while it's open and
 * visible. Enable it only for signed-in app screens (pass `enabled`).
 */
export function useGlobalPresence(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const id = screenId();

    const beat = () => {
      if (document.visibilityState === 'visible') {
        void heartbeatPresenceAction(id).catch(() => {});
      }
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);
    // Beat immediately when the tab becomes visible again.
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [enabled]);
}
