'use client';

/** Store manager (pilot: premium time and PDF papers, coins only) and recent orders. */

import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Item = {
  id: string;
  kind: 'premium' | 'digital';
  title: string;
  description: string | null;
  price_coins: number;
  stock: number | null;
  premium_subject: string | null;
  premium_days: number | null;
  file_key: string | null;
  featured: boolean;
  active: boolean;
  orders: number;
};
type Order = { id: string; title: string; kind: string; coins_spent: number; status: string; user_id: string; downloads: number; created_at: string };

const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

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
  const [kind, setKind] = useState<'premium' | 'digital'>('premium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(100);
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
    stock: i.stock,
    premiumSubject: i.premium_subject,
    premiumDays: i.premium_days,
    featured: i.featured,
    active: i.active,
    ...patch,
  });

  return (
    <div className="flex flex-col gap-4">
      <Section title="Add an item">
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as 'premium' | 'digital')}>
            <option value="premium">Premium time</option>
            <option value="digital">PDF paper</option>
          </select>
          <input className={`${inputClass} min-w-56`} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={`${inputClass} min-w-56 flex-1`} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex flex-col">Coins<input type="number" className={`${inputClass} w-24`} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
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
          <button
            className={buttonClass}
            disabled={busy || !title.trim()}
            onClick={() =>
              save({
                kind,
                title: title.trim(),
                description: description.trim() || null,
                priceCoins: price,
                premiumSubject: kind === 'premium' ? subject : null,
                premiumDays: kind === 'premium' ? days : null,
                stock: stock ? Number(stock) : null,
                active: true,
              }).then(() => setTitle(''))
            }
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">A paper stays off sale until its PDF is uploaded. Merch and rupee prices come after the pilot.</p>
      </Section>
      <Section title="Items">
        <ErrorLine error={items.error} />
        <Table head={['Item', 'Price', 'Details', 'Sold', 'On sale', '']} empty={(items.data?.items.length ?? 0) === 0}>
          {(items.data?.items ?? []).map((i) => (
            <tr key={i.id}>
              <Td>{i.title}{i.featured ? ' ★' : ''}</Td>
              <Td>{i.price_coins} coins</Td>
              <Td className="capitalize">
                {i.kind === 'premium' ? `${i.premium_subject} · ${i.premium_days} days` : i.file_key ? 'PDF uploaded' : 'No PDF yet'}
                {i.stock !== null ? ` · stock ${i.stock}` : ''}
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
