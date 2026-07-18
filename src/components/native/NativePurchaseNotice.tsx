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

  return (
    <div className="w-full rounded-xl border border-border bg-muted/40 p-4 text-center space-y-2">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {title ? `${title} — purchases aren't available in the app` : "Purchases aren't available in the app"}
      </p>
      <p className="text-xs text-muted-foreground">
        Premium is managed on the o3origin.com website. Anything you own there unlocks here
        automatically.
      </p>
      {linkOutReady ? (
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={() => void handleLinkOut()}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-2 h-3.5 w-3.5" />}
          Get Premium on the web
        </Button>
      ) : null}
    </div>
  );
}
