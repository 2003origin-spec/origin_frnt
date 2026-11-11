'use client';

/**
 * "Get the app" entry (SEO_APP_DOWNLOAD_NOTES.md). A real link to the Play
 * Store listing, so it works without JavaScript and crawlers see it:
 *  - Android: the link just opens Google Play.
 *  - iPhone / iPad: the "Get the Origin app" dialog on its iOS tab ("coming soon").
 *  - Desktop / other: the same dialog on its Android tab (QR code + Google Play).
 *  - Inside our Android app: not shown.
 * The dialog sits above the landing drawer and the More sheet (z 90), so those
 * stay open underneath and focus returns to this button on close.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Check, Clock, Copy, ExternalLink, Share2, Smartphone, X } from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import type { AppPlacement, AppPlatform } from '@/lib/analytics-events';
import { appDownloadAction, detectAppDevice, PLAY_STORE_QR_SRC, PLAY_STORE_URL, type AppDevice } from '@/lib/app-download';
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

type AppTab = 'android' | 'ios';

export default function GetAppButton({
  placement,
  className,
  children,
  label,
}: {
  placement: AppPlacement;
  className: string;
  children: ReactNode;
  /** Accessible name when the visible text alone is not enough (icon-only buttons). */
  label?: string;
}) {
  const device = useAppDevice();
  /** The tab the dialog opens on; null = closed. */
  const [openOn, setOpenOn] = useState<AppTab | null>(null);
  /** Bumped on each open, so the dialog starts fresh (no stale "Copied"); closing keeps the key so it closes normally. */
  const [opens, setOpens] = useState(0);
  const [platform, setPlatform] = useState<AppPlatform>('desktop');
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
    setPlatform(platformOf(current));
    setOpens((n) => n + 1);
    setOpenOn(action === 'ios_sheet' ? 'ios' : 'android');
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
      <GetAppDialog
        key={opens}
        openOn={openOn}
        onClose={() => setOpenOn(null)}
        placement={placement}
        platform={platform}
        returnFocusTo={triggerRef}
      />
    </>
  );
}

function GetAppDialog({
  openOn,
  onClose,
  placement,
  platform,
  returnFocusTo,
}: {
  openOn: AppTab | null;
  onClose: () => void;
  placement: AppPlacement;
  /** The visitor's device (analytics only). */
  platform: AppPlatform;
  /** Opened from code (not a Radix trigger), so say where focus goes back on close. */
  returnFocusTo: RefObject<HTMLAnchorElement | null>;
}) {
  const ids = useId();
  const [tab, setTab] = useState<AppTab>(openOn ?? 'android');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  // Clipboard blocked: once the link field is on screen, select it so it can be copied by hand.
  useEffect(() => {
    if (!copyFailed) return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [copyFailed]);
  // Only read while open, which is always in the browser (closed on the server).
  const canShare = openOn !== null && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const switchTab = (next: string) => {
    if (next !== 'android' && next !== 'ios') return;
    setTab(next);
    trackEvent('app_download_click', { platform, placement, action: next === 'ios' ? 'tab_ios' : 'tab_android' });
  };

  const copy = async () => {
    trackEvent('app_download_click', { platform, placement, action: 'copy_link' });
    try {
      await navigator.clipboard.writeText(PLAY_STORE_URL);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      // Clipboard blocked: show the link field (the effect above selects it).
      setCopyFailed(true);
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

  const button = `inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold ${focusRing}`;
  const tabClass = `inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-[15px] font-semibold transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-foreground data-[state=inactive]:hover:bg-surface-3 ${focusRing}`;

  return (
    <DialogPrimitive.Root open={openOn !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className="fixed inset-x-4 bottom-4 z-[91] mx-auto flex max-h-[88dvh] max-w-[420px] flex-col gap-4 overflow-y-auto rounded-[22px] border border-border bg-card p-5 text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 motion-reduce:data-[state=open]:animate-none sm:bottom-auto sm:top-[max(1rem,8dvh)] sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Smartphone className="size-5" />
              </span>
              <DialogPrimitive.Title className="font-display text-[22px] font-bold leading-tight">Get the Origin app</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className={`-mr-2 -mt-1 flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground ${focusRing}`}
            >
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">Download Origin for Android, or see when the iOS app is coming.</DialogPrimitive.Description>

          <TabsPrimitive.Root value={tab} onValueChange={switchTab} className="flex flex-col gap-4">
            <TabsPrimitive.List aria-label="Phone type" className="flex gap-1 rounded-full bg-surface-2 p-1">
              <TabsPrimitive.Trigger value="android" className={tabClass}>
                Android
              </TabsPrimitive.Trigger>
              <TabsPrimitive.Trigger value="ios" className={tabClass}>
                iOS
              </TabsPrimitive.Trigger>
            </TabsPrimitive.List>

            <TabsPrimitive.Content value="android" className="flex flex-col items-center gap-4 outline-none">
              {/* White card in both themes: a QR needs dark-on-light and a quiet zone to scan. */}
              <div className="rounded-[18px] border border-border bg-white p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
                <img
                  src={PLAY_STORE_QR_SRC}
                  width={200}
                  height={200}
                  alt="QR code that opens Origin on Google Play"
                  className="block size-[180px] sm:size-[200px]"
                />
              </div>
              <p className="text-center text-[15px] font-semibold">Scan with your Android phone to get the app</p>

              <div className="flex w-full items-center gap-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('app_download_click', { platform, placement, action: 'play_store' })}
                className={`${button} w-full bg-primary text-primary-foreground`}
              >
                <ExternalLink aria-hidden className="size-4" /> Open on Google Play
              </a>
              <div className="flex w-full gap-2">
                <button type="button" onClick={() => void copy()} className={`${button} border border-border hover:bg-surface-2`}>
                  {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                {canShare ? (
                  <button type="button" onClick={() => void share()} className={`${button} border border-border hover:bg-surface-2`}>
                    <Share2 aria-hidden className="size-4" /> Share
                  </button>
                ) : null}
              </div>
              {copyFailed ? (
                <div className="flex w-full flex-col gap-1">
                  <label htmlFor={`${ids}-link`} className="text-[13px] font-medium text-muted-foreground">
                    Copy this link
                  </label>
                  <input
                    ref={linkInputRef}
                    id={`${ids}-link`}
                    readOnly
                    value={PLAY_STORE_URL}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`h-12 w-full min-w-0 rounded-[12px] border border-border bg-background px-3 text-[14px] text-foreground ${focusRing}`}
                  />
                </div>
              ) : null}
              <p aria-live="polite" className="sr-only">
                {copied ? 'Link copied' : ''}
              </p>
            </TabsPrimitive.Content>

            {/* Shorter than the Android panel: the dialog is top-anchored on sm+ (tabs never move); on phones the bottom sheet just resizes. */}
            <TabsPrimitive.Content value="ios" className="flex flex-col items-center gap-3 py-6 text-center outline-none">
              <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                <Clock className="size-7" />
              </span>
              <p className="font-display text-[20px] font-bold">The iOS app is coming soon</p>
              <p className="max-w-[320px] text-[14px] leading-relaxed text-muted-foreground">
                We are building Origin for iPhone and iPad. Until then, Origin works fully in your browser, with the same account.
              </p>
            </TabsPrimitive.Content>
          </TabsPrimitive.Root>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
