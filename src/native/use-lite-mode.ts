'use client';

import { useState } from 'react';
import { isNativeApp } from './is-native-app';

/**
 * Lite-mode signal (MOBILE_UI_REDESIGN_PLAN.md, Phase 2).
 *
 * When `true`, heavy visuals — WebGL/Three.js mascots, animated shader
 * backgrounds (Prism / ParticleBackground / OriginLogoBackground / FloatingLines)
 * — should be swapped for static or cheap fallbacks. This is the single switch
 * that keeps the Android WebView (and genuinely low-end phones) fast, without
 * touching the rich desktop-web experience.
 *
 * Triggers:
 *  - inside the Android shell (`isNativeApp()`) — the WebView + remote-content
 *    model makes continuous WebGL the main cause of jank / OOM;
 *  - the user asked for reduced motion;
 *  - a self-reported very-low-memory device (`navigator.deviceMemory <= 2`).
 *
 * Computed once on first render (lazy state) so heavy components never mount even
 * for a frame in the app. SSR returns `true` (the heavy components are all
 * `ssr:false` anyway, so this only affects the very first client paint).
 */
export function useLiteMode(): boolean {
  const [lite] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      if (isNativeApp()) return true;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      if (typeof mem === 'number' && mem <= 2) return true;
    } catch {
      /* be permissive — a detection failure should not force lite */
    }
    return false;
  });
  return lite;
}
