'use client';

/**
 * Store manager: premium time, PDF papers and, once switched on, merch with
 * delivery (B91); the merch packing and shipping queue; recent orders.
 */

import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, LegalNote, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Kind = 'premium' | 'digital' | 'merch';
type Item = {
  id: string;
  kind: Kind;
  title: string;
  description: string | null;
  price_coins: number;
  price_paise: number;
  stock: number | null;
  premium_subject: string | null;
  premium_days: number | null;
  file_key: string | null;
  image_key: string | null;
  size_stock: Record<string, number> | null;
  featured: boolean;
  active: boolean;
  orders: number;
};
type Order = { id: string; title: string; kind: string; coins_spent: number; status: string; user_id: string; downloads: number; created_at: string };

const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

/** "S:10, M:5" ⇄ { S: 10, M: 5 }; anything unreadable is left for the server to refuse. */
function parseSizes(text: string): Record<string, number> | null {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const out: Record<string, number> = {};
  for (const part of parts) {
    const [size, count] = part.split(':').map((x) => x.trim());
    out[size] = Number(count ?? 0);
  }
  return out;
}
const CLOTHING_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL'];
/** Same order as the store (store-rules sortSizes): clothing sizes, then numbers, then the rest. */
const sizeRank = (s: string) => {
  const i = CLOTHING_ORDER.indexOf(s.toUpperCase());
  return i >= 0 ? i : /^\d+$/.test(s) ? 100 + Number(s) : 100_000;
};
const sizesText = (s: Record<string, number> | null) =>
  s
    ? Object.entries(s)
        .sort(([a], [b]) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')
    : '';

async function uploadMerchPhoto(itemId: string, file: File) {
  const ticket = await adminSend<{ uploadUrl: string; objectKey: string }>(`/store/items/${itemId}/image`, 'POST', {
    mimeType: file.type,
    sizeBytes: file.size,
  });
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
  await adminSend(`/store/items/${itemId}/image/confirm`, 'POST', { objectKey: ticket.objectKey });
}

async function uploadPaper(itemId: string, file: File) {
  const ticket = await adminSend<{ uploadUrl: string; objectKey: string }>(`/store/items/${itemId}/file`, 'POST', {
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
  });
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
  await adminSend(`/store/items/${itemId}/file/confirm`, 'POST', { objectKey: ticket.objectKey });
}

export function StorePanel() {
  const items = useAdminData<{ items: Item[] }>('/store/items');
  const orders = useAdminData<{ orders: Order[] }>('/store/orders');
  const [kind, setKind] = useState<Kind>('premium');
  // Inline stock editor for merch sizes (no browser pop-up).
  const [stockEdit, setStockEdit] = useState<{ id: string; text: string } | null>(null);
  const [sizes, setSizes] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(100);
  const [rupees, setRupees] = useState('');
  const [subject, setSubject] = useState('physics');
  const [days, setDays] = useState(30);
  const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (body: Record<string, unknown>, id?: string) => {
    setBusy(true);
    try {
      await adminSend(id ? `/store/items/${id}` : '/store/items', id ? 'PUT' : 'POST', body);
      toast.success('Saved.');
      await items.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  const toBody = (i: Item, patch: Partial<Record<string, unknown>> = {}) => ({
    kind: i.kind,
    title: i.title,
    description: i.description,
    priceCoins: i.price_coins,
    pricePaise: i.price_paise,
    stock: i.stock,
    premiumSubject: i.premium_subject,
    premiumDays: i.premium_days,
    featured: i.featured,
    active: i.active,
    sizeStock: i.size_stock,
    ...patch,
  });

  return (
    <div className="flex flex-col gap-4">
      <Section title="Add an item">
        <div className="mb-3">
          <LegalNote>
            store purchases are final and coins never turn into money. Put items on sale only after the legal team
            confirms these terms; PDF papers need the right to sell them.
          </LegalNote>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="premium">Premium time</option>
            <option value="digital">PDF paper</option>
            <option value="merch">Merch (delivered)</option>
          </select>
          <input className={`${inputClass} min-w-56`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={`${inputClass} min-w-56 flex-1`} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex flex-col">Coins<input type="number" className={`${inputClass} w-24`} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
          <label className="flex flex-col">
            Plus ₹ (optional)
            <input
              inputMode="decimal"
              className={`${inputClass} w-24`}
              placeholder="0"
              value={rupees}
              onChange={(e) => setRupees(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </label>
          {kind === 'premium' ? (
            <>
              <select className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex flex-col">Days<input type="number" className={`${inputClass} w-20`} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
            </>
          ) : (
            <label className="flex flex-col">Stock (blank = unlimited)<input className={`${inputClass} w-24`} value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} /></label>
          )}
          {kind === 'merch' && (
            <label className="flex flex-col">
              Sizes and stock (blank = one size)
              <input className={`${inputClass} w-48`} placeholder="S:10, M:20, L:10" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </label>
          )}
          <button
            className={buttonClass}
            disabled={busy || !title.trim()}
            onClick={() =>
              save({
                kind,
                title: title.trim(),
                description: description.trim() || null,
                priceCoins: price,
                pricePaise: rupees ? Math.round(Number(rupees) * 100) : 0,
                premiumSubject: kind === 'premium' ? subject : null,
                premiumDays: kind === 'premium' ? days : null,
                stock: kind === 'merch' && parseSizes(sizes) ? null : stock ? Number(stock) : null,
                sizeStock: kind === 'merch' ? parseSizes(sizes) : null,
                active: true,
              }).then(() => {
                setTitle('');
                setSizes('');
                setRupees('');
              })
            }
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A paper stays off sale until its PDF is uploaded. Merch needs &ldquo;Merch in the store&rdquo; switched on in Settings → Extra parts;
          add a photo after saving it. A rupee price needs &ldquo;Rupee prices in the store&rdquo; switched on; it is paid through Razorpay
          on the website only, never inside the Android app.
        </p>
        <div className="mt-2">
          <LegalNote>merch is physical goods: delivery times, damaged items and returns need store terms from the legal team before anything goes on sale.</LegalNote>
        </div>
      </Section>
      <Section title="Items">
        <ErrorLine error={items.error} />
        <Table head={['Item', 'Price', 'Details', 'Sold', 'On sale', '']} empty={(items.data?.items.length ?? 0) === 0}>
          {(items.data?.items ?? []).map((i) => (
            <tr key={i.id}>
              <Td>{i.title}{i.featured ? ' ★' : ''}</Td>
              <Td className="whitespace-nowrap">
                {i.price_coins > 0 ? `${i.price_coins} coins` : ''}
                {i.price_coins > 0 && i.price_paise > 0 ? ' + ' : ''}
                {i.price_paise > 0 ? `₹${(i.price_paise / 100).toLocaleString('en-IN')}` : ''}
              </Td>
              <Td className="capitalize">
                {i.kind === 'premium'
                  ? `${i.premium_subject} · ${i.premium_days} days`
                  : i.kind === 'merch'
                    ? `merch${i.image_key ? '' : ' · no photo yet'}`
                    : i.file_key
                      ? 'PDF uploaded'
                      : 'No PDF yet'}
                {i.size_stock ? ` · ${sizesText(i.size_stock)}` : i.stock !== null ? ` · stock ${i.stock}` : ''}
              </Td>
              <Td>{i.orders}</Td>
              <Td>{i.active ? 'Yes' : 'No'}</Td>
              <Td className="flex flex-wrap gap-1">
                <button className={ghostButtonClass} disabled={busy || (i.kind === 'digital' && !i.file_key && !i.active)} onClick={() => save(toBody(i, { active: !i.active }), i.id)}>
                  {i.active ? 'Take off sale' : 'Put on sale'}
                </button>
                <button className={ghostButtonClass} disabled={busy} onClick={() => save(toBody(i, { featured: !i.featured }), i.id)}>
                  {i.featured ? 'Unfeature' : 'Feature'}
                </button>
                {i.kind === 'merch' && (
                  <>
                    {stockEdit?.id === i.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          className={`${inputClass} w-40`}
                          aria-label="Sizes and stock, like S:10, M:20 (blank = one size)"
                          value={stockEdit.text}
                          onChange={(e) => setStockEdit({ id: i.id, text: e.target.value })}
                        />
                        <button
                          className={ghostButtonClass}
                          disabled={busy}
                          onClick={() => {
                            const parsed = parseSizes(stockEdit.text);
                            setStockEdit(null);
                            void save(toBody(i, { sizeStock: parsed, stock: parsed ? null : i.stock }), i.id);
                          }}
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button className={ghostButtonClass} disabled={busy} onClick={() => setStockEdit({ id: i.id, text: sizesText(i.size_stock) })}>
                        Stock
                      </button>
                    )}
                    <label className={`${ghostButtonClass} cursor-pointer`}>
                      {i.image_key ? 'Replace photo' : 'Add photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBusy(true);
                          try {
                            await uploadMerchPhoto(i.id, file);
                            toast.success('Photo uploaded.');
                            await items.reload();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Upload failed.');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </label>
                  </>
                )}
                {i.kind === 'digital' && (
                  <label className={`${ghostButtonClass} cursor-pointer`}>
                    {i.file_key ? 'Replace PDF' : 'Upload PDF'}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        try {
                          await uploadPaper(i.id, file);
                          toast.success('PDF uploaded.');
                          await items.reload();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Upload failed.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
      <MerchOrders />
      <Section title="Recent orders">
        <ErrorLine error={orders.error} />
        <Table head={['When', 'Item', 'Coins', 'Status', 'Downloads', 'User']} empty={(orders.data?.orders.length ?? 0) === 0}>
          {(orders.data?.orders ?? []).map((o) => (
            <tr key={o.id}>
              <Td>{fmtDate(o.created_at)}</Td>
              <Td>{o.title}</Td>
              <Td>{o.coins_spent}</Td>
              <Td>{o.status}</Td>
              <Td>{o.kind === 'digital' ? o.downloads : '—'}</Td>
              <Td className="font-mono text-xs">{o.user_id}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}

type MerchOrder = {
  id: string;
  title: string;
  size: string | null;
  coinsSpent: number;
  shipStatus: 'to_pack' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  courier: string | null;
  trackingNo: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  delivery: { name: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string } | null;
  createdAt: string;
  cancelReason: string | null;
};

const SHIP_TABS: { status: MerchOrder['shipStatus']; label: string }[] = [
  { status: 'to_pack', label: 'To pack' },
  { status: 'packed', label: 'Packed' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
];

/** The merch packing and shipping queue (B91): oldest first while it still has to go out. */
function MerchOrders() {
  const [status, setStatus] = useState<MerchOrder['shipStatus']>('to_pack');
  const orders = useAdminData<{ orders: MerchOrder[] }>(`/store/merch-orders?status=${status}`);
  const [shipping, setShipping] = useState<Record<string, { courier: string; trackingNo: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});

  const act = async (order: MerchOrder, action: 'pack' | 'ship' | 'deliver' | 'cancel') => {
    let body: Record<string, unknown> = { action };
    if (action === 'ship') body = { action, ...(shipping[order.id] ?? { courier: '', trackingNo: '' }) };
    if (action === 'cancel') {
      const reason = (cancelReason[order.id] ?? '').trim();
      if (reason.length < 5) {
        toast.error('Write why it is cancelled (the buyer gets the coins back and an email).');
        return;
      }
      body = { action, reason };
    }
    setBusy(order.id);
    try {
      await adminSend(`/store/orders/${order.id}/shipment`, 'POST', body);
      toast.success(action === 'cancel' ? 'Cancelled; coins returned.' : 'Updated.');
      await orders.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Merch orders">
      <div className="mb-3 flex flex-wrap gap-2 text-sm" role="tablist" aria-label="Merch order status">
        {SHIP_TABS.map((t) => (
          <button
            key={t.status}
            role="tab"
            aria-selected={status === t.status}
            className={status === t.status ? buttonClass : ghostButtonClass}
            onClick={() => setStatus(t.status)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ErrorLine error={orders.error} />
      <Table head={['Ordered', 'Item', 'Deliver to', 'Shipment', '']} empty={(orders.data?.orders.length ?? 0) === 0}>
        {(orders.data?.orders ?? []).map((o) => (
          <tr key={o.id}>
            <Td className="whitespace-nowrap">{fmtDate(o.createdAt)}</Td>
            <Td>
              {o.title}
              {o.size ? ` · ${o.size}` : ''}
              <span className="block text-xs text-muted-foreground">{o.coinsSpent} coins · {o.buyerEmail}</span>
            </Td>
            <Td className="text-xs">
              {o.delivery ? (
                <>
                  <span className="font-medium">{o.delivery.name}</span> · {o.delivery.phone}
                  <span className="block">{o.delivery.line1}{o.delivery.line2 ? `, ${o.delivery.line2}` : ''}</span>
                  <span className="block">{o.delivery.city}, {o.delivery.state} {o.delivery.pincode}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Address deleted</span>
              )}
            </Td>
            <Td className="text-xs">
              {o.shipStatus === 'cancelled'
                ? `Cancelled: ${o.cancelReason ?? ''}`
                : o.courier
                  ? `${o.courier} · ${o.trackingNo}`
                  : '—'}
            </Td>
            <Td>
              <div className="flex flex-wrap items-center gap-1">
                {o.shipStatus === 'to_pack' && (
                  <button className={ghostButtonClass} disabled={busy === o.id} onClick={() => act(o, 'pack')}>Mark packed</button>
                )}
                {(o.shipStatus === 'to_pack' || o.shipStatus === 'packed') && (
                  <>
                    <input
                      className={`${inputClass} w-28`}
                      placeholder="Courier"
                      aria-label="Courier"
                      value={shipping[o.id]?.courier ?? ''}
                      onChange={(e) => setShipping({ ...shipping, [o.id]: { courier: e.target.value, trackingNo: shipping[o.id]?.trackingNo ?? '' } })}
                    />
                    <input
                      className={`${inputClass} w-36`}
                      placeholder="Tracking number"
                      aria-label="Tracking number"
                      value={shipping[o.id]?.trackingNo ?? ''}
                      onChange={(e) => setShipping({ ...shipping, [o.id]: { courier: shipping[o.id]?.courier ?? '', trackingNo: e.target.value } })}
                    />
                    <button className={buttonClass} disabled={busy === o.id} onClick={() => act(o, 'ship')}>Shipped</button>
                    <input
                      className={`${inputClass} w-44`}
                      placeholder="Cancel reason"
                      aria-label="Why the order is cancelled"
                      value={cancelReason[o.id] ?? ''}
                      onChange={(e) => setCancelReason({ ...cancelReason, [o.id]: e.target.value })}
                    />
                    <button className={ghostButtonClass} disabled={busy === o.id} onClick={() => act(o, 'cancel')}>Cancel</button>
                  </>
                )}
                {o.shipStatus === 'shipped' && (
                  <button className={ghostButtonClass} disabled={busy === o.id} onClick={() => act(o, 'deliver')}>Mark delivered</button>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        The buyer gets an email when an order ships or is cancelled. Addresses are deleted 90 days after delivery or cancellation.
      </p>
    </Section>
  );
}
