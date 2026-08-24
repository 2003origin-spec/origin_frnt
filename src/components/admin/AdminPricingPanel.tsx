'use client';

/**
 * Admin Control Plane — pricing editor. Sets per-subject monthly price and the
 * all-subjects bundle offer. Saving creates a fresh Razorpay plan server-side, so
 * NEW subscriptions bill the new amount (existing subscriptions are untouched).
 */

import { useState } from 'react';
import { IndianRupee, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';

type SubjectPrice = {
  subject: string;
  amountMinor: number;
  listAmountMinor: number | null;
  currency: string;
  razorpayPlanId: string | null;
  overridden: boolean;
};
type Bundle = {
  id: string;
  name: string;
  subjects: string[];
  amountMinor: number;
  listAmountMinor: number | null;
  currency: string;
  active: boolean;
} | null;
type TermOption = {
  termMonths: number;
  label: string;
  discountPercent: number;
  sortOrder: number;
  active: boolean;
};

const SUBJECT_LABEL: Record<string, string> = {
  physics: 'Physics', chemistry: 'Chemistry', mathematics: 'Mathematics', biology: 'Biology',
};
const ALL_SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

export function AdminPricingPanel({ initial }: { initial: { subjects: SubjectPrice[]; bundle: Bundle; terms?: TermOption[] } }) {
  const [subjects, setSubjects] = useState<SubjectPrice[]>(initial.subjects);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.subjects.map((s) => [s.subject, String(Math.round(s.amountMinor / 100))])),
  );
  const [mrpDrafts, setMrpDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.subjects.map((s) => [s.subject, s.listAmountMinor == null ? '' : String(Math.round(s.listAmountMinor / 100))])),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const [bundleName, setBundleName] = useState(initial.bundle?.name ?? 'All subjects');
  const [bundleRupees, setBundleRupees] = useState(String(initial.bundle ? Math.round(initial.bundle.amountMinor / 100) : 1499));
  const [bundleMrp, setBundleMrp] = useState(String(initial.bundle?.listAmountMinor == null ? '' : Math.round(initial.bundle.listAmountMinor / 100)));
  const [bundleActive, setBundleActive] = useState(initial.bundle?.active ?? false);
  const [bundleSubjects, setBundleSubjects] = useState<string[]>(initial.bundle?.subjects ?? ALL_SUBJECTS);
  const [terms, setTerms] = useState<TermOption[]>(initial.terms ?? []);

  async function saveSubject(subject: string) {
    const rupees = Number(drafts[subject]);
    if (!Number.isFinite(rupees) || rupees < 0) return toast.error('Enter a valid amount.');
    const mrpRaw = mrpDrafts[subject]?.trim() ?? '';
    const mrpRupees = mrpRaw ? Number(mrpRaw) : null;
    if (mrpRupees !== null && (!Number.isFinite(mrpRupees) || mrpRupees < 0)) return toast.error('Enter a valid MRP.');
    setBusy(`subject:${subject}`);
    try {
      const res = await mutateJson('/api/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({ subject, amountMinor: Math.round(rupees * 100), listAmountMinor: mrpRupees === null ? null : Math.round(mrpRupees * 100) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Save failed (${res.status})`);
      const updated = (await res.json()) as SubjectPrice;
      setSubjects((prev) => prev.map((s) => (s.subject === subject ? updated : s)));
      setMrpDrafts((prev) => ({ ...prev, [subject]: updated.listAmountMinor == null ? '' : String(Math.round(updated.listAmountMinor / 100)) }));
      toast.success(`${SUBJECT_LABEL[subject]} price updated. New subscriptions bill ₹${rupees}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function saveBundle() {
    const rupees = Number(bundleRupees);
    if (!Number.isFinite(rupees) || rupees < 0) return toast.error('Enter a valid bundle amount.');
    const mrpRupees = bundleMrp.trim() ? Number(bundleMrp) : null;
    if (mrpRupees !== null && (!Number.isFinite(mrpRupees) || mrpRupees < 0)) return toast.error('Enter a valid bundle MRP.');
    if (bundleSubjects.length === 0) return toast.error('Pick at least one subject.');
    setBusy('bundle');
    try {
      const res = await mutateJson('/api/admin/pricing', {
        method: 'PATCH',
        body: JSON.stringify({
          id: initial.bundle?.id,
          name: bundleName,
          subjects: bundleSubjects,
          amountMinor: Math.round(rupees * 100),
          listAmountMinor: mrpRupees === null ? null : Math.round(mrpRupees * 100),
          active: bundleActive,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Save failed (${res.status})`);
      toast.success('Bundle offer saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function saveTerm(term: TermOption) {
    setBusy(`term:${term.termMonths}`);
    try {
      const res = await mutateJson('/api/admin/pricing', {
        method: 'PATCH',
        body: JSON.stringify({ kind: 'term', ...term }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Save failed (${res.status})`);
      const updated = (await res.json()) as TermOption;
      setTerms((prev) => prev.map((row) => (row.termMonths === updated.termMonths ? updated : row)));
      toast.success(`${updated.label} term updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  async function deactivateTerm(termMonths: number) {
    setBusy(`term:${termMonths}`);
    try {
      const res = await mutateJson('/api/admin/pricing', {
        method: 'DELETE',
        body: JSON.stringify({ termMonths }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Deactivate failed (${res.status})`);
      setTerms((prev) => prev.map((row) => (row.termMonths === termMonths ? { ...row, active: false } : row)));
      toast.success('Term deactivated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deactivate failed.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleTerm(term: TermOption) {
    if (term.active) {
      await deactivateTerm(term.termMonths);
      return;
    }
    await saveTerm({ ...term, active: true });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <IndianRupee className="w-6 h-6 text-emerald-500" /> Pricing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set the monthly price per subject and the all-subjects bundle. Changes create a new Razorpay plan and apply to <strong>new subscriptions only</strong> — existing subscribers keep their price.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Per-subject price</h3>
        </div>
        <div className="divide-y divide-border">
          {subjects.map((s) => (
            <div key={s.subject} className="flex items-center gap-4 px-5 py-4">
              <span className="w-32 font-bold text-foreground">{SUBJECT_LABEL[s.subject] ?? s.subject}</span>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">₹</span>
                <input
                  type="number"
                  min={0}
                  value={drafts[s.subject] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.subject]: e.target.value }))}
                  className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                MRP ₹
                <input
                  type="number"
                  min={0}
                  placeholder="optional"
                  value={mrpDrafts[s.subject] ?? ''}
                  onChange={(e) => setMrpDrafts((d) => ({ ...d, [s.subject]: e.target.value }))}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              {!s.overridden && <span className="text-[10px] text-muted-foreground">default</span>}
              <button
                onClick={() => saveSubject(s.subject)}
                disabled={busy !== null}
                className="ml-auto rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 text-sm font-bold disabled:opacity-50"
              >
                {busy === `subject:${s.subject}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-500" /> Bundle offer
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Name</span>
            <input value={bundleName} onChange={(e) => setBundleName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Display MRP (₹/month)</span>
            <input type="number" min={0} value={bundleMrp} onChange={(e) => setBundleMrp(e.target.value)} placeholder="optional" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-bold text-muted-foreground mb-1">Price (₹/month)</span>
            <input type="number" min={0} value={bundleRupees} onChange={(e) => setBundleRupees(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
        </div>
        <div>
          <span className="block text-xs font-bold text-muted-foreground mb-2">Subjects included</span>
          <div className="flex flex-wrap gap-2">
            {ALL_SUBJECTS.map((s) => {
              const on = bundleSubjects.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setBundleSubjects((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${on ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'border-border text-muted-foreground'}`}
                >
                  {SUBJECT_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bundleActive} onChange={(e) => setBundleActive(e.target.checked)} />
          <span className="text-foreground">Active (shown to students)</span>
        </label>
        <button
          onClick={saveBundle}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
        >
          {busy === 'bundle' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save bundle'}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Term ladder</h3>
          <p className="text-xs text-muted-foreground mt-1">Term discounts apply to prepaid one-time purchases. Changes are live after cache invalidation.</p>
        </div>
        <div className="divide-y divide-border">
          {terms.map((term) => (
            <div key={term.termMonths} className="grid grid-cols-[4rem_1fr_7rem_5rem_auto] items-center gap-3 px-5 py-3">
              <input type="number" min={1} value={term.termMonths} disabled className="w-16 rounded-lg border border-border bg-muted px-2 py-1.5 text-sm text-foreground" />
              <input value={term.label} onChange={(e) => setTerms((prev) => prev.map((row) => row.termMonths === term.termMonths ? { ...row, label: e.target.value } : row))} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="number" min={0} max={90} value={term.discountPercent} onChange={(e) => setTerms((prev) => prev.map((row) => row.termMonths === term.termMonths ? { ...row, discountPercent: Number(e.target.value) } : row))} className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />%
              </label>
              <input type="number" min={0} value={term.sortOrder} onChange={(e) => setTerms((prev) => prev.map((row) => row.termMonths === term.termMonths ? { ...row, sortOrder: Number(e.target.value) } : row))} className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" aria-label="Sort order" />
              <div className="flex items-center gap-2 justify-end">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={term.active}
                    onChange={(e) => setTerms((prev) => prev.map((row) => row.termMonths === term.termMonths ? { ...row, active: e.target.checked } : row))}
                    aria-label={`${term.label} active`}
                  />
                  Active
                </label>
                <button onClick={() => saveTerm(term)} disabled={busy !== null} className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-50">{busy === `term:${term.termMonths}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</button>
                <button onClick={() => void toggleTerm(term)} disabled={busy !== null} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-40">{term.active ? 'Disable' : 'Enable'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
