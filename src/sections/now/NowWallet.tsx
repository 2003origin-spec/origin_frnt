'use client';

/**
 * Ori Coins wallet (plan doc screen "Wallet"): balance (spendable and
 * pending), recent movements, and coin packs bought through the existing
 * Razorpay checkout. Inside the Android app packs are not sold (Play billing
 * policy); the wallet still shows balance and history.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';

import { NativePurchaseNotice, useIsNativeApp } from '@/components/native/NativePurchaseNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRazorpay, loadRazorpayScript, verifyPayment } from '@/features/payments/client';
import { apiCall } from '@/lib/api';

type Wallet = {
  balance: { available: number; pending: number };
  movements: { transferId: string; kind: string; direction: 'debit' | 'credit'; amount: number; createdAt: string; availableAt: string | null; expiresAt: string | null }[];
  packs: { id: string; name: string; coins: number; pricePaise: number }[];
  welcomeGranted: number;
};

const KIND_LABEL: Record<string, string> = {
  welcome_grant: 'Welcome coins',
  pack_purchase: 'Coin pack',
  promo_bonus: 'Bonus coins',
  session_hold: 'Live help (held)',
  session_release: 'Live help (returned)',
  session_capture: 'Earned from a session',
  extension: 'More time',
  tip: 'Tip',
  store_spend: 'Store',
  admin_adjustment: 'From Origin',
  pack_refund: 'Pack refund',
  expiry: 'Bonus coins expired',
  transfer: 'Transfer',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function NowWallet() {
  const isNative = useIsNativeApp();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiCall('/now/wallet');
    setWallet(res as Wallet);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/wallet')
      .then((res) => !cancelled && setWallet(res as Wallet))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const buy = async (pack: Wallet['packs'][number]) => {
    setBusy(pack.id);
    setError(null);
    setNotice(null);
    try {
      const order = await apiCall('/now/wallet/packs', {
        method: 'POST',
        headers: { 'Idempotency-Key': `pack:${pack.id}:${crypto.randomUUID()}` },
        body: JSON.stringify({ packId: pack.id }),
      });
      const ready = await loadRazorpayScript();
      const Razorpay = getRazorpay();
      if (!ready || !Razorpay || !order.keyId || !order.razorpayOrderId) throw new Error('Payments are not available right now.');
      await new Promise<void>((resolve, reject) => {
        const checkout = new Razorpay({
          key: order.keyId,
          amount: order.amountMinor,
          currency: order.currency,
          order_id: order.razorpayOrderId,
          name: 'Origin',
          description: `${pack.name}: ${order.coins.toLocaleString('en-IN')} Ori Coins${order.bonusCoins ? ` + ${order.bonusCoins} bonus` : ''}`,
          handler: async (response) => {
            try {
              await verifyPayment({
                razorpayOrderId: response.razorpay_order_id ?? '',
                razorpayPaymentId: response.razorpay_payment_id ?? '',
                razorpaySignature: response.razorpay_signature ?? '',
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        });
        checkout.open();
      });
      setNotice(`${order.coins + (order.bonusCoins ?? 0)} coins added.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!wallet) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Ori Coins</h1>
          <p className="text-sm text-muted-foreground">Use coins for live help and in the store. Coins are never turned back into money.</p>
        </div>
        <Link href="/now/store" className="rounded-md border px-3 py-1 text-sm hover:bg-muted">Store</Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Spendable</p>
          <p className="flex items-center gap-2 text-2xl font-semibold"><Coins className="h-5 w-5 text-amber-600" aria-hidden />{wallet.balance.available.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Pending (earned, spendable after 24 h)</p>
          <p className="text-2xl font-semibold">{wallet.balance.pending.toLocaleString('en-IN')}</p>
        </div>
      </div>
      {wallet.welcomeGranted > 0 && <p className="text-sm text-emerald-700" role="status">Welcome! {wallet.welcomeGranted} coins were added to your wallet.</p>}
      {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Buy coins</CardTitle></CardHeader>
        <CardContent>
          {isNative ? (
            <NativePurchaseNotice title="Coins are bought on the website" />
          ) : wallet.packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coin packs on sale right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {wallet.packs.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="flex items-center gap-1 text-lg font-semibold"><Coins className="h-4 w-4 text-amber-600" aria-hidden />{p.coins.toLocaleString('en-IN')}</p>
                  <Button onClick={() => buy(p)} disabled={busy !== null}>
                    {busy === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}₹{(p.pricePaise / 100).toLocaleString('en-IN')}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Bought coins are not refundable once added, except for a failed or duplicate payment.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {wallet.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {wallet.movements.map((m) => (
                <li key={`${m.transferId}-${m.direction}`} className="flex items-center justify-between py-2">
                  <span>
                    {KIND_LABEL[m.kind] ?? m.kind}
                    <span className="block text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {m.availableAt && new Date(m.availableAt).getTime() > Date.now() ? ` · spendable from ${new Date(m.availableAt).toLocaleDateString('en-IN')}` : ''}
                      {m.expiresAt ? ` · expires ${new Date(m.expiresAt).toLocaleDateString('en-IN')}` : ''}
                    </span>
                  </span>
                  <span className={`font-semibold tabular-nums ${m.direction === 'credit' ? 'text-emerald-700' : ''}`}>
                    {m.direction === 'credit' ? '+' : '−'}{m.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
