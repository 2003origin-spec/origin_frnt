'use client';

/**
 * "Offer alerts" on the solver shift card (decision B85): turns on browser
 * push for this browser so an offer reaches the solver while the shift tab
 * is in the background. Needs the site's service worker (registered in
 * production builds) and the server's VAPID key; otherwise it explains why
 * alerts are unavailable and the foreground-only rule stays.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

import { apiCall } from '@/lib/api';

type State = 'loading' | 'unavailable' | 'blocked' | 'off' | 'on';

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function browserSupportsPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function NowOfferAlerts({ onChange }: { onChange: (on: boolean) => void }) {
  const [state, setState] = useState<State>('loading');
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const settle = useCallback(
    (next: State, reason: string | null = null) => {
      setState(next);
      setWhy(reason);
      onChange(next === 'on');
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = (await apiCall('/now/push/config')) as { publicKey: string | null; subscribed: boolean };
        if (cancelled) return;
        if (!config.publicKey) return settle('unavailable', 'Offer alerts are not switched on for Origin yet.');
        if (!browserSupportsPush()) return settle('unavailable', 'This browser cannot show offer alerts.');
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return settle('unavailable', 'Reload this page once to enable offer alerts in this browser.');
        setPublicKey(config.publicKey);
        if (Notification.permission === 'denied') return settle('blocked');
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        settle(subscription && config.subscribed ? 'on' : 'off');
      } catch {
        if (!cancelled) settle('unavailable', 'Could not check offer alerts.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settle]);

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return settle(permission === 'denied' ? 'blocked' : 'off');
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const json = subscription.toJSON();
      await apiCall('/now/push/subscription', { method: 'PUT', body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys ?? null }) });
      settle('on');
    } catch (err) {
      settle('off', err instanceof Error ? err.message : 'Could not turn on offer alerts.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiCall('/now/push/subscription', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(
          () => undefined,
        );
        await subscription.unsubscribe().catch(() => false);
      }
      settle('off');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="now-offer-alerts">
      {state === 'on' ? <Bell className="h-4 w-4 text-primary" aria-hidden /> : <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden />}
      <span className="text-muted-foreground">
        {state === 'on' && 'Offer alerts on: you stay online with this tab in the background and get an alert for each offer.'}
        {state === 'off' && 'Offer alerts off: keep this screen in front to stay online.'}
        {state === 'blocked' && 'Alerts are blocked for this site in your browser settings. Allow notifications to turn them on.'}
        {state === 'unavailable' && (why ?? 'Offer alerts are not available here.')}
      </span>
      {state === 'off' && (
        <button onClick={turnOn} disabled={busy} className="rounded-md border border-primary px-2 py-1 font-medium text-primary disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Turn on offer alerts'}
        </button>
      )}
      {state === 'on' && (
        <button onClick={turnOff} disabled={busy} className="rounded-md border px-2 py-1 disabled:opacity-60">
          Turn off
        </button>
      )}
      {why && state === 'off' && <span className="text-red-600">{why}</span>}
    </div>
  );
}
