'use client';

/**
 * Floating "Get the app / Scan to download" pill for the logged-out landing
 * page (SEO_APP_DOWNLOAD_NOTES.md). Tablet and desktop only (phones have the
 * menu entry and the section). Bottom-left, because "Play with Ori" sits
 * bottom-right; below 1024 px it sits above the sticky "Begin Your Journey"
 * bar. Can be hidden for the rest of the browser session. Not shown inside the
 * Android app shell, and only the landing page renders it.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChevronRight, QrCode, X } from 'lucide-react';

import GetAppButton, { useAppDevice } from './GetAppButton';

const DISMISS_KEY = 'origin:app-pill-dismissed';
const listeners = new Set<() => void>();
/** Read from session storage once, then kept here (also covers blocked storage). */
let dismissedCache: boolean | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readDismissed(): boolean {
  if (dismissedCache === null) {
    try {
      dismissedCache = window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissedCache = false; // Storage blocked: the pill just shows.
    }
  }
  return dismissedCache;
}

function dismiss() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Storage blocked: hidden until the next page load only.
  }
  dismissedCache = true;
  listeners.forEach((l) => l());
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function AppDownloadPill() {
  const device = useAppDevice();
  // Server and hydration: treat as dismissed, so nothing flashes before we know.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  // Step aside while the "Get Origin on your phone" section or the footer is on screen:
  // the section already has the same action, and the footer's links sit bottom-left.
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (dismissed || typeof IntersectionObserver === 'undefined') return;
    const targets = [document.getElementById('get-the-app'), document.querySelector('footer')].filter((el): el is HTMLElement => el !== null);
    if (!targets.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setCovered(visible.size > 0);
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [dismissed]);
  if (dismissed || covered || device === null || device === 'in-app') return null;

  return (
    <div className="fixed bottom-28 left-4 z-40 hidden items-center gap-1 rounded-full border border-border bg-card/95 p-1 pr-1 shadow-lg backdrop-blur md:flex lg:bottom-6 lg:left-6">
      <GetAppButton
        placement="landing_pill"
        className="flex min-h-12 items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left text-foreground hover:bg-surface-2"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <QrCode className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[14px] font-bold">
            Get the app <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Free</span>
          </span>
          {/* An Android tablet goes straight to Google Play; everyone else gets the QR. */}
          <span className="text-[12px] text-muted-foreground">{device === 'android' ? 'Open Google Play' : 'Scan to download'}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </GetAppButton>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide the get the app button"
        className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground ${focusRing}`}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
