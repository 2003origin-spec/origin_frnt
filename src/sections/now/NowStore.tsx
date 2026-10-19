'use client';

/**
 * Origin Store (build step 9; plan doc screen "Store"): premium subject time
 * and digital papers, and merch with delivery once switched on (B91), paid in
 * Ori Coins. Inside the Android app the store is browse-only (Play billing
 * policy), like coin packs.
 */

import { useCallback, useEffect, useState } from 'react';
import { Coins, Download, FileText, Loader2, Package, Shirt, Sparkles, Truck } from 'lucide-react';

import { NativePurchaseNotice, useIsNativeApp } from '@/components/native/NativePurchaseNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { formatISTDayDMY } from '@/lib/format-time';

import { NowAddressForm, emptyAddress, type AddressDraft } from './NowAddressForm';

type Item = {
  id: string;
  kind: 'premium' | 'digital' | 'merch';
  title: string;
  description: string | null;
  priceCoins: number;
  inStock: boolean;
  premiumSubject: string | null;
  premiumDays: number | null;
  featured: boolean;
  owned: boolean;
  coinPremiumUntil: string | null;
  sizes: { size: string; inStock: boolean }[] | null;
  imageUrl: string | null;
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
  size: string | null;
  shipStatus: 'to_pack' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | null;
  courier: string | null;
  trackingNo: string | null;
  deliverTo: string | null;
  canCancel: boolean;
};

const SHIP_LABEL: Record<NonNullable<Order['shipStatus']>, string> = {
  to_pack: 'Order placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled, coins returned',
};

const SUBJECT_LABEL: Record<string, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

function dateLabel(iso: string): string {
  return formatISTDayDMY(iso);
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
  // Merch checkout (B91): the chosen size per item and the delivery address.
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [address, setAddress] = useState<AddressDraft>(emptyAddress);
  const [addressLoaded, setAddressLoaded] = useState(false);

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

  const startMerch = async (item: Item) => {
    setConfirming(item.id);
    if (addressLoaded) return;
    try {
      const last = (await apiCall('/now/store/address')) as { address: AddressDraft | null };
      if (last.address) setAddress({ ...emptyAddress, ...last.address, line2: last.address.line2 ?? '' });
    } catch {
      // No saved address: the form starts empty.
    }
    setAddressLoaded(true);
  };

  const buy = async (item: Item) => {
    setBusy(item.id);
    setError(null);
    try {
      const result = await apiCall(`/now/store/items/${item.id}/buy`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `${item.id}:${crypto.randomUUID()}` },
        body: JSON.stringify(item.kind === 'merch' ? { size: sizes[item.id] ?? null, delivery: address } : {}),
      });
      const order = result.order as Order;
      setNotice(
        result.alreadyOwned
          ? `You already own "${item.title}". It is in My orders.`
          : order.premiumExpiresAt
            ? `${SUBJECT_LABEL[order.premiumSubject ?? ''] ?? 'Premium'} premium is on until ${dateLabel(order.premiumExpiresAt)}.`
            : item.kind === 'merch'
              ? `Order placed for "${item.title}". We will email you when it ships.`
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

  const cancelOrder = async (order: Order) => {
    setBusy(order.id);
    setError(null);
    try {
      await apiCall(`/now/store/orders/${order.id}/cancel`, { method: 'POST' });
      setNotice(`Order cancelled; ${order.coinsSpent} coins are back in your wallet.`);
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
          <p className="text-sm text-muted-foreground">
            Spend your Ori Coins on premium time and papers{items.some((i) => i.kind === 'merch') ? ', and Origin merch delivered to your door' : ''}.
          </p>
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
            const isMerch = item.kind === 'merch';
            const chosenSize = sizes[item.id];
            const needsSize = isMerch && item.sizes !== null && !chosenSize;
            return (
              <Card key={item.id} className={item.featured ? 'border-primary/40' : undefined}>
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- product photos come from the public media bucket
                  <img src={item.imageUrl} alt={item.title} className="aspect-[4/3] w-full rounded-t-xl object-cover" loading="lazy" />
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {item.kind === 'premium' ? (
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    ) : isMerch ? (
                      <Shirt className="h-4 w-4 text-primary" aria-hidden />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" aria-hidden />
                    )}
                    {item.title}
                  </CardTitle>
                  <CardDescription>
                    {item.kind === 'premium'
                      ? `${SUBJECT_LABEL[item.premiumSubject ?? ''] ?? ''} premium for ${item.premiumDays} days`
                      : isMerch
                        ? 'Delivered to your address in India'
                        : 'PDF paper, yours to download'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {item.description && <p className="text-muted-foreground">{item.description}</p>}
                  {isMerch && item.sizes && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Size">
                      {item.sizes.map((s) => (
                        <button
                          key={s.size}
                          type="button"
                          disabled={!s.inStock}
                          aria-pressed={chosenSize === s.size}
                          onClick={() => setSizes({ ...sizes, [item.id]: s.size })}
                          className={`min-w-10 rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                            chosenSize === s.size ? 'border-primary bg-primary/10 text-primary' : ''
                          }`}
                        >
                          {s.size}
                        </button>
                      ))}
                    </div>
                  )}
                  {isMerch && confirming === item.id && !isNative && (
                    <NowAddressForm idPrefix={`now-addr-${item.id}`} value={address} onChange={setAddress} />
                  )}
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
                        <Button size="sm" onClick={() => buy(item)} disabled={busy === item.id || needsSize}>
                          {busy === item.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                          {needsSize ? 'Pick a size' : `Pay ${item.priceCoins} coins`}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy === item.id}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={short ? 'outline' : 'default'}
                        disabled={short}
                        onClick={() => (isMerch ? void startMerch(item) : setConfirming(item.id))}
                      >
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
                  <p className="font-medium">
                    {order.title}
                    {order.size ? ` · size ${order.size}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateLabel(order.createdAt)} · {order.coinsSpent} coins
                    {order.premiumExpiresAt ? ` · premium until ${dateLabel(order.premiumExpiresAt)}` : ''}
                  </p>
                  {order.shipStatus && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      {order.shipStatus === 'shipped' || order.shipStatus === 'delivered' ? (
                        <Truck className="h-3.5 w-3.5 text-primary" aria-hidden />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      )}
                      <span className="font-medium">{SHIP_LABEL[order.shipStatus]}</span>
                      {order.courier && order.trackingNo && (
                        <span className="text-muted-foreground">
                          · {order.courier}, tracking <span className="font-mono">{order.trackingNo}</span>
                        </span>
                      )}
                      {order.deliverTo && <span className="text-muted-foreground">· to {order.deliverTo}</span>}
                    </p>
                  )}
                </div>
                {order.canCancel && (
                  <Button size="sm" variant="ghost" onClick={() => cancelOrder(order)} disabled={busy === order.id}>
                    Cancel order
                  </Button>
                )}
                {order.canDownload && (
                  <Button size="sm" variant="outline" onClick={() => download(order)} disabled={busy === order.id}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Premium time and papers are final; coins are not refunded for them. A merch order can be cancelled for its coins
          until we start packing it.
        </p>
      </section>
    </div>
  );
}
