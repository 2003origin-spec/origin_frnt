'use client';

/**
 * Origin Store (build step 9; plan doc screen "Store"): pilot items are
 * premium subject time and digital papers, paid in Ori Coins only. Inside the
 * Android app the store is browse-only (Play billing policy), like coin packs.
 */

import { useCallback, useEffect, useState } from 'react';
import { Coins, Download, FileText, Loader2, Sparkles } from 'lucide-react';

import { NativePurchaseNotice, useIsNativeApp } from '@/components/native/NativePurchaseNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';

type Item = {
  id: string;
  kind: 'premium' | 'digital';
  title: string;
  description: string | null;
  priceCoins: number;
  inStock: boolean;
  premiumSubject: string | null;
  premiumDays: number | null;
  featured: boolean;
  owned: boolean;
  coinPremiumUntil: string | null;
};

type Order = {
  id: string;
  title: string;
  kind: string;
  coinsSpent: number;
  status: string;
  premiumSubject: string | null;
  premiumExpiresAt: string | null;
  canDownload: boolean;
  createdAt: string;
};

const SUBJECT_LABEL: Record<string, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function NowStore() {
  const isNative = useIsNativeApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [store, mine] = await Promise.all([apiCall('/now/store/items'), apiCall('/now/store/orders')]);
      setItems(store.items as Item[]);
      setBalance(store.balance as number);
      setOrders(mine.orders as Order[]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = async (item: Item) => {
    setBusy(item.id);
    setError(null);
    try {
      const result = await apiCall(`/now/store/items/${item.id}/buy`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `${item.id}:${crypto.randomUUID()}` },
      });
      const order = result.order as Order;
      setNotice(
        result.alreadyOwned
          ? `You already own "${item.title}". It is in My orders.`
          : order.premiumExpiresAt
            ? `${SUBJECT_LABEL[order.premiumSubject ?? ''] ?? 'Premium'} premium is on until ${dateLabel(order.premiumExpiresAt)}.`
            : `"${item.title}" is yours. Download it from My orders.`,
      );
      setConfirming(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const download = async (order: Order) => {
    setBusy(order.id);
    try {
      const link = await apiCall(`/now/store/orders/${order.id}/download`, { method: 'POST' });
      window.open(link.url as string, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!items) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Origin Store</h1>
          <p className="text-sm text-muted-foreground">Spend your Ori Coins on premium time and papers.</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700">
          <Coins className="h-4 w-4" aria-hidden /> {balance.toLocaleString('en-IN')} coins
        </span>
      </header>

      {isNative && <NativePurchaseNotice title="Store purchases are made on the website" />}
      {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in the store yet. Check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const short = balance < item.priceCoins;
            return (
              <Card key={item.id} className={item.featured ? 'border-primary/40' : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {item.kind === 'premium' ? <Sparkles className="h-4 w-4 text-primary" aria-hidden /> : <FileText className="h-4 w-4 text-primary" aria-hidden />}
                    {item.title}
                  </CardTitle>
                  <CardDescription>
                    {item.kind === 'premium'
                      ? `${SUBJECT_LABEL[item.premiumSubject ?? ''] ?? ''} premium for ${item.premiumDays} days`
                      : 'PDF paper, yours to download'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {item.description && <p className="text-muted-foreground">{item.description}</p>}
                  {item.coinPremiumUntil && (
                    <p className="text-xs text-muted-foreground">
                      Your coin premium runs until {dateLabel(item.coinPremiumUntil)}; buying again adds {item.premiumDays} days after that.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-semibold">
                      <Coins className="h-4 w-4 text-amber-600" aria-hidden /> {item.priceCoins.toLocaleString('en-IN')}
                    </span>
                    {item.owned ? (
                      <span className="text-xs text-muted-foreground">Owned — see My orders</span>
                    ) : !item.inStock ? (
                      <span className="text-xs text-muted-foreground">Sold out</span>
                    ) : isNative ? null : confirming === item.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => buy(item)} disabled={busy === item.id}>
                          {busy === item.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                          Pay {item.priceCoins} coins
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy === item.id}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant={short ? 'outline' : 'default'} disabled={short} onClick={() => setConfirming(item.id)}>
                        {short ? `Need ${item.priceCoins - balance} more` : 'Buy'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">My orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{order.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateLabel(order.createdAt)} · {order.coinsSpent} coins
                    {order.premiumExpiresAt ? ` · premium until ${dateLabel(order.premiumExpiresAt)}` : ''}
                  </p>
                </div>
                {order.canDownload && (
                  <Button size="sm" variant="outline" onClick={() => download(order)} disabled={busy === order.id}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Store purchases are final; coins are not refunded for items you have bought.</p>
      </section>
    </div>
  );
}
