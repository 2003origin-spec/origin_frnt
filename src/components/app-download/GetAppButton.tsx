'use client';

/**
 * "Get the app" nav entry (SEO_APP_DOWNLOAD_NOTES.md). A real link to the Play
 * Store listing, so it works without JavaScript and crawlers see it:
 *  - Android: the link just opens Google Play.
 *  - iPhone / iPad: a small dialog, "iOS app coming soon", with the Android
 *    link to copy or share.
 *  - Desktop / other: the same dialog with the Android link and "iOS: coming soon".
 *  - Inside our Android app: not shown.
 * The dialog sits above the landing drawer and the More sheet (z 90), so those
 * stay open underneath and focus returns to this button on close.
 */

import { useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, Clock, Copy, ExternalLink, Share2, Smartphone, X } from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import type { AppPlacement, AppPlatform } from '@/lib/analytics-events';
import { appDownloadAction, detectAppDevice, PLAY_STORE_URL, type AppDevice } from '@/lib/app-download';
import { isNativeApp } from '@/native/is-native-app';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function readDevice(): AppDevice {
  return detectAppDevice({
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints,
    nativeShell: isNativeApp(),
  });
}

const noSubscribe = () => () => undefined;

/** null on the server and during hydration (both render the plain link), then the device. */
export function useAppDevice(): AppDevice | null {
  return useSyncExternalStore(noSubscribe, readDevice, () => null);
}

function platformOf(device: AppDevice): AppPlatform {
  return device === 'android' ? 'android' : device === 'ios' ? 'ios' : 'desktop';
}

export default function GetAppButton({
  placement,
  className,
  children,
  label,
}: {
  placement: AppPlacement;
  className: string;
  children: ReactNode;
  /** Accessible name when the visible text is short (e.g. the rail's "App"). */
  label?: string;
}) {
  const device = useAppDevice();
  const [sheet, setSheet] = useState<'ios' | 'desktop' | null>(null);
  /** Bumped on each open, so the dialog starts fresh (no stale "Copied"); closing keeps the key so it closes normally. */
  const [opens, setOpens] = useState(0);
  const triggerRef = useRef<HTMLAnchorElement>(null);

  if (device === 'in-app') return null;

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Decide on click, not from state, so a click before hydration settles is still right.
    const current = readDevice();
    const action = appDownloadAction(current);
    if (action === 'hidden') {
      event.preventDefault();
      return;
    }
    if (action === 'play_store') {
      trackEvent('app_download_click', { platform: 'android', placement, action: 'play_store' });
      return; // the link opens Google Play
    }
    event.preventDefault();
    trackEvent('app_download_click', { platform: platformOf(current), placement, action: 'open_sheet' });
    setOpens((n) => n + 1);
    setSheet(action === 'ios_sheet' ? 'ios' : 'desktop');
  };

  return (
    <>
      <a
        ref={triggerRef}
        href={PLAY_STORE_URL}
        rel="noopener"
        onClick={onClick}
        aria-label={label}
        aria-haspopup={device && device !== 'android' ? 'dialog' : undefined}
        className={`${className} ${focusRing}`}
      >
        {children}
      </a>
      <GetAppDialog key={opens} kind={sheet} onClose={() => setSheet(null)} placement={placement} returnFocusTo={triggerRef} />
    </>
  );
}

function GetAppDialog({
  kind,
  onClose,
  placement,
  returnFocusTo,
}: {
  kind: 'ios' | 'desktop' | null;
  onClose: () => void;
  placement: AppPlacement;
  /** Opened from code (not a Radix trigger), so say where focus goes back on close. */
  returnFocusTo: RefObject<HTMLAnchorElement | null>;
}) {
  const ids = useId();
  const [copied, setCopied] = useState(false);
  const platform: AppPlatform = kind === 'ios' ? 'ios' : 'desktop';
  // Only read while open, which is always in the browser (closed on the server).
  const canShare = kind !== null && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    trackEvent('app_download_click', { platform, placement, action: 'copy_link' });
    try {
      await navigator.clipboard.writeText(PLAY_STORE_URL);
      setCopied(true);
    } catch {
      // Clipboard blocked: select the visible link so the user can copy it by hand.
      const input = document.getElementById(`${ids}-link`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  };

  const share = async () => {
    trackEvent('app_download_click', { platform, placement, action: 'share' });
    try {
      await navigator.share({ title: 'Origin on Google Play', text: 'Origin app for JEE and NEET (Android)', url: PLAY_STORE_URL });
    } catch {
      // Cancelled or not allowed: nothing to do.
    }
  };

  const ios = kind === 'ios';
  const button = `inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold ${focusRing}`;

  return (
    <DialogPrimitive.Root open={kind !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className="fixed inset-x-4 bottom-4 z-[91] mx-auto flex max-h-[85dvh] max-w-[420px] flex-col gap-4 overflow-y-auto rounded-[22px] border border-border bg-card p-5 text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-start justify-between gap-3">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Smartphone className="size-6" />
            </span>
            <DialogPrimitive.Close
              aria-label="Close"
              className={`-mr-2 -mt-2 flex size-12 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground ${focusRing}`}
            >
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-1.5">
            <DialogPrimitive.Title className="font-display text-[22px] font-bold leading-tight">
              {ios ? 'The iOS app is coming soon' : 'Get the Origin app'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-[14px] leading-relaxed text-muted-foreground">
              {ios
                ? 'We are building Origin for iPhone and iPad. Until then, Origin works fully here in your browser. You can share the Android app with a friend.'
                : 'Origin is on Google Play for Android phones. Open the link on your phone, or copy it and send it to yourself.'}
            </DialogPrimitive.Description>
          </div>

          <ul className="flex flex-col gap-2 text-[14px]">
            <li className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-4 py-2">
              <span className="font-semibold">Android</span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Check aria-hidden className="size-4 text-primary" /> On Google Play
              </span>
            </li>
            <li className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-4 py-2">
              <span className="font-semibold">iPhone &amp; iPad</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock aria-hidden className="size-4" /> Coming soon
              </span>
            </li>
          </ul>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-link`} className="text-[13px] font-medium text-muted-foreground">
              Android app link
            </label>
            <input
              id={`${ids}-link`}
              readOnly
              value={PLAY_STORE_URL}
              onFocus={(e) => e.currentTarget.select()}
              className={`h-12 w-full min-w-0 rounded-[12px] border border-border bg-background px-3 text-[14px] text-foreground ${focusRing}`}
            />
          </div>

          <div className="flex flex-col gap-2 min-[380px]:flex-row">
            {ios ? null : (
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('app_download_click', { platform, placement, action: 'play_store' })}
                className={`${button} bg-primary text-primary-foreground`}
              >
                <ExternalLink aria-hidden className="size-4" /> Open Google Play
              </a>
            )}
            <button type="button" onClick={() => void copy()} className={`${button} border border-border hover:bg-surface-2 ${ios ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}>
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {ios && canShare ? (
              <button type="button" onClick={() => void share()} className={`${button} border border-border hover:bg-surface-2`}>
                <Share2 aria-hidden className="size-4" /> Share
              </button>
            ) : null}
          </div>
          <p aria-live="polite" className="sr-only">
            {copied ? 'Link copied' : ''}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
