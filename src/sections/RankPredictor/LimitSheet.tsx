'use client';

/**
 * Shown when a logged-out visitor asks for a 3rd check in one IST day (plan
 * §8.4). No dark patterns: the first two results are never hidden, the sheet
 * closes with Escape, the X or "Not now", and the form stays filled in.
 */

import { useRef, type RefObject } from 'react';
import Link from 'next/link';
import { LogIn, UserPlus } from 'lucide-react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { trackEvent } from '@/lib/analytics';
import type { PredictorPlacement } from '@/lib/analytics-events';

import { FREE_CHECKS_LABEL, LOGIN_HREF, SIGNUP_HREF } from './login-links';

/** The sheet's built-in close button at a 48 px touch target. */
export const SHEET_CLOSE_48 = 'top-2 right-2 flex size-12 items-center justify-center rounded-full opacity-100';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function LimitSheet({
  open,
  onOpenChange,
  onLeave,
  returnFocusTo,
  placement,
}: {
  /** GA: where the limit was hit (page or landing widget). */
  placement: PredictorPlacement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called right before going to /auth, to keep the form for the way back. */
  onLeave: () => void;
  /** The sheet opens from code, not a trigger, so say where focus goes back on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
}) {
  const loginRef = useRef<HTMLAnchorElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          loginRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo.current?.focus();
        }}
        closeClassName={SHEET_CLOSE_48}
        className="max-h-[85dvh] overflow-y-auto rounded-t-[26px] border-border bg-card px-4 pb-6 sm:mx-auto sm:max-w-xl"
      >
        <SheetHeader className="px-0 pr-12">
          <SheetTitle className="font-display text-[21px] font-bold">You have used today&apos;s {FREE_CHECKS_LABEL}</SheetTitle>
          <SheetDescription className="text-[14px] leading-relaxed text-muted-foreground">
            Log in or sign up free for unlimited checks. Your marks stay filled in, and your result shows as soon as you are back.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          <Link
            ref={loginRef}
            href={LOGIN_HREF}
            onClick={() => {
              trackEvent('auth_cta_click', { action: 'log_in', source: 'predictor_limit', placement });
              onLeave();
            }}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground ${focus}`}
          >
            <LogIn aria-hidden className="size-5" /> Log in
          </Link>
          <Link
            href={SIGNUP_HREF}
            onClick={() => {
              trackEvent('auth_cta_click', { action: 'sign_up', source: 'predictor_limit', placement });
              onLeave();
            }}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border px-6 text-[16px] font-semibold text-foreground hover:bg-surface-2 ${focus}`}
          >
            <UserPlus aria-hidden className="size-5" /> Sign up free
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full px-6 text-[15px] font-semibold text-foreground hover:bg-surface-2 ${focus}`}
          >
            Not now
          </button>
          <p className="text-center text-[13px] text-muted-foreground">Free checks come back at 12:00 am IST.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
