'use client';

/**
 * Admin Control Plane — pricing editor. Sets per-subject monthly price and the
 * all-subjects bundle offer. Saving creates a fresh Razorpay plan server-side, so
 * NEW subscriptions bill the new amount (existing subscriptions are untouched).
 */

import { useState } from 'react';
import { IndianRupee, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

type SubjectPrice = { subject: string; amountMinor: number; razorpayPlanId: string | null; overridden: boolean };
type Bundle = { id: string; name: string; subjects: string[]; amountMinor: number; active: boolean } | null;

const SUBJECT_LABEL: Record<string, string> = {
  physics: 'Physics', chemistry: 'Chemistry', mathematics: 'Mathematics', biology: 'Biology',
};
const ALL_SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

export function AdminPricingPanel({ initial }: { initial: { subjects: SubjectPrice[]; bundle: Bundle } }) {
  const [subjects, setSubjects] = useState<SubjectPrice[]>(initial.subjects);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.subjects.map((s) => [s.subject, String(Math.round(s.amountMinor / 100))])),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const [bundleName, setBundleName] = useState(initial.bundle?.name ?? 'All subjects');
  const [bundleRupees, setBundleRupees] = useState(String(initial.bundle ? Math.round(initial.bundle.amountMinor / 100) : 1499));
  const [bundleActive, setBundleActive] = useState(initial.bundle?.active ?? false);
  const [bundleSubjects, setBundleSubjects] = useState<string[]>(initial.bundle?.subjects ?? ALL_SUBJECTS);

  async function saveSubject(subject: string) {
    const rupees = Number(drafts[subject]);
    if (!Number.isFinite(rupees) || rupees < 0) return toast.error('Enter a valid amount.');
    setBusy(`subject:${subject}`);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, amountMinor: Math.round(rupees * 100) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Save failed (${res.status})`);
      const updated = (await res.json()) as SubjectPrice;
      setSubjects((prev) => prev.map((s) => (s.subject === subject ? updated : s)));
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
    if (bundleSubjects.length === 0) return toast.error('Pick at least one subject.');
    setBusy('bundle');
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: initial.bundle?.id,
          name: bundleName,
          subjects: bundleSubjects,
          amountMinor: Math.round(rupees * 100),
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
    </div>
  );
}
