'use client';

/**
 * Consumption-only purchase gate for the Android app (plan §5.4 / D3).
 *
 * Google Play forbids selling digital goods in-app outside Play Billing, so
 * inside the shell every Razorpay checkout surface renders this notice
 * instead. Default posture is informational only — "manage on the website" —
 * which is the always-compliant Netflix model. When the remote config enables
 * `linkOutEnabled` (jurisdiction-dependent, §10.2 — OFF for India unless UCB
 * ships), a "Get Premium on the web" button appears that opens the site in
 * the EXTERNAL browser via a one-time login handoff, so the user lands
 * already signed in.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Globe, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { mutateJson } from '@/lib/csrf';
import { isNativeApp } from '@/native/is-native-app';
import { getOriginNative, hasNativeCapability } from '@/native/bridge';
import { fetchMobileConfig } from '@/native/mobile-config';

const noopSubscribe = () => () => {};

/** Hydration-safe "inside the Android shell?" hook (false during SSR pass). */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isNativeApp, () => false);
}

export function NativePurchaseNotice({ title }: { title?: string }) {
  const [linkOutReady, setLinkOutReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [config, capable] = await Promise.all([
        fetchMobileConfig(),
        hasNativeCapability('linkOut'),
      ]);
      if (!cancelled) setLinkOutReady(config.linkOutEnabled && capable);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLinkOut = async () => {
    setBusy(true);
    try {
      const response = await mutateJson('/api/mobile/link-out', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'premium' }),
      });
      if (!response.ok) throw new Error('Could not open the website. Please try again.');
      const { url } = (await response.json()) as { url?: string };
      if (!url) throw new Error('Could not open the website. Please try again.');
      await getOriginNative()?.openLinkOut({ url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the website.');
    } finally {
      setBusy(false);
    }
  };

  // Shaped like the CTA it stands in for.
  //
  // On the web an unowned subject card ends in a "Subscribe · ₹1/mo" pill and an
  // owned one in "Manage / Cancel". In the app this notice replaced that pill
  // with a bordered paragraph block, so the four cards no longer lined up and
  // the locked ones read as broken rather than as deliberate (reported from the
  // Android shell, 2026-09-21).
  //
  // It is now the same full-width rounded-full pill, measured to 52px against
  // SubjectCheckout's own 53px "Manage / Cancel" and 51px "Subscribe", with the
  // explanation demoted to a single caption line beneath. What it
  // is NOT is a purchase control: Play forbids selling digital goods outside
  // Play Billing, so this stays a `role="note"` — announced as a note, not
  // focusable, nothing to tap — unless `linkOutEnabled` is on, in which case it
  // becomes a real button that hands off to the site (§10.2; OFF for India).
  if (linkOutReady) {
    return (
      <div className="w-full space-y-1.5">
        <Button
          type="button"
          className="w-full rounded-full py-6"
          onClick={() => void handleLinkOut()}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
          Get Premium on the web
        </Button>
        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          Opens o3origin.com — you stay signed in.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      <div
        role="note"
        aria-label={
          title
            ? `${title} cannot be purchased in the app. Manage Premium on o3origin.com.`
            : 'Purchases are not available in the app. Manage Premium on o3origin.com.'
        }
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-4 text-sm font-medium text-muted-foreground"
      >
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Manage on o3origin.com</span>
      </div>
      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        Purchases aren&apos;t available in the app.
      </p>
    </div>
  );
}
