'use client';

/**
 * Admin Control Plane — coupon manager. Create discount codes for PLATFORM
 * subject/bundle subscriptions, attribute them to a coaching center, and
 * enable/disable. Discounts apply at student checkout (subject path).
 */

import { useState } from 'react';
import { Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';

type Coupon = {
  code: string;
  description: string | null;
  kind: 'percent' | 'flat';
  value: number;
  appliesTo: 'subject' | 'bundle' | 'any';
  subject: string | null;
  coachingCenterWorkspaceId: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  timesRedeemed: number;
  validTo: string | null;
  active: boolean;
  redemptions: number;
};

const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

export function AdminCouponsPanel({ initial }: { initial: Coupon[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>(initial);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('10');
  const [appliesTo, setAppliesTo] = useState<'subject' | 'bundle' | 'any'>('any');
  const [subject, setSubject] = useState('');
  const [centerId, setCenterId] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [validTo, setValidTo] = useState('');

  async function create() {
    if (!code.trim()) return toast.error('Enter a code.');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        kind,
        value: kind === 'percent' ? Number(value) : Math.round(Number(value) * 100),
        appliesTo,
        perUserLimit: Number(perUserLimit) || 1,
      };
      if (appliesTo === 'subject' && subject) body.subject = subject;
      if (centerId.trim()) body.coachingCenterWorkspaceId = centerId.trim();
      if (maxRedemptions) body.maxRedemptions = Number(maxRedemptions);
      if (validTo) body.validTo = new Date(validTo).toISOString();

      const res = await mutateJson('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Failed (${res.status})`);
      const created = (await res.json()) as Coupon;
      setCoupons((prev) => [{ ...created, redemptions: 0 }, ...prev.filter((c) => c.code !== created.code)]);
      toast.success(`Coupon ${created.code} created.`);
      setCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Coupon) {
    try {
      const res = await mutateJson('/api/admin/coupons', {
        method: 'PATCH',
        body: JSON.stringify({ code: c.code, active: !c.active }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setCoupons((prev) => prev.map((x) => (x.code === c.code ? { ...x, active: !x.active } : x)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  }

  function describe(c: Coupon): string {
    const amount = c.kind === 'percent' ? `${c.value}% off` : `₹${Math.round(c.value / 100)} off`;
    const scope = c.appliesTo === 'subject' ? (c.subject ? `${c.subject} only` : 'any subject') : c.appliesTo;
    return `${amount} · ${scope}`;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Ticket className="w-6 h-6 text-emerald-500" /> Coupons
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Discount codes for platform subject &amp; bundle subscriptions. Optionally attribute one to a coaching center.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">New coupon</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ORIGIN20" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'flat')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
              <option value="percent">Percent (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">{kind === 'percent' ? 'Percent off' : 'Rupees off'}</span>
            <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Applies to</span>
            <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as 'subject' | 'bundle' | 'any')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
              <option value="any">Any</option>
              <option value="subject">Subject</option>
              <option value="bundle">Bundle</option>
            </select>
          </label>
          {appliesTo === 'subject' && (
            <label className="text-sm">
              <span className="block text-xs font-bold text-muted-foreground mb-1">Subject (optional)</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
                <option value="">All subjects</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Coaching center ID (optional)</span>
            <input value={centerId} onChange={(e) => setCenterId(e.target.value)} placeholder="ws_…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Max total uses (optional)</span>
            <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Per-user limit</span>
            <input type="number" min={1} value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Valid until (optional)</span>
            <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
        </div>
        <button onClick={create} disabled={busy} className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 text-sm font-bold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create coupon'}
        </button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-muted-foreground">
            <tr>
              <th className="text-left font-bold px-4 py-3">Code</th>
              <th className="text-left font-bold px-4 py-3">Discount</th>
              <th className="text-left font-bold px-4 py-3">Used</th>
              <th className="text-left font-bold px-4 py-3">Valid until</th>
              <th className="text-right font-bold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No coupons yet.</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.code} className="border-t border-border">
                  <td className="px-4 py-3 font-mono font-bold text-foreground">{c.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{describe(c)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.validTo ? new Date(c.validTo).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(c)} className={`px-3 py-1 rounded-full text-xs font-bold ${c.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {c.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
