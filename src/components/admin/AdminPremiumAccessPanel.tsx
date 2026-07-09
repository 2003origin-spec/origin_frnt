'use client';

/**
 * Admin Premium Pro access console. Grant/revoke admin-comp Premium Pro to free
 * students (individually, multi-selected, or "all free"), toggle Event Mode (new
 * signups auto-granted while ON), and monitor the free/paid/comp/teacher split.
 *
 * Real paying (Razorpay) premium users are shown as "Paid — protected": the
 * toggle only ever writes source='admin_comp' grants, so a payer is never touched.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Search, Loader2, Lock, ShieldCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiJson } from '@/lib/teacher-client';

type PlanKey = 'paid' | 'comp' | 'teacher' | 'free';
type PlanFilter = PlanKey | 'all';

type Counts = { totalStudents: number; free: number; paid: number; comp: number; teacher: number };
type EventMode = { active: boolean; autoRevertAt: string | null; updatedBy: string | null; updatedAt: string | null };
type Overview = { counts: Counts; eventMode: EventMode };

type RosterRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  plan: PlanKey;
  isPremium: boolean;
  premiumExpiry: string | null;
  compExpiresAt: string | null;
  joinedAt: string;
};

const PAGE_SIZE = 50;
const API = '/api/admin/premium-access';

const PLAN_TONE: Record<PlanKey, string> = {
  paid: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  comp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  teacher: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  free: 'bg-muted text-muted-foreground',
};
const PLAN_LABEL: Record<PlanKey, string> = { paid: 'Paid', comp: 'Granted', teacher: 'Teacher', free: 'Free' };

const FILTERS: { value: PlanFilter; label: string }[] = [
  { value: 'free', label: 'Free students' },
  { value: 'comp', label: 'Granted (comp)' },
  { value: 'paid', label: 'Paid premium' },
  { value: 'teacher', label: 'Teacher grant' },
  { value: 'all', label: 'All students' },
];

/** datetime-local value → ISO 8601 (with tz), or undefined when empty. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN') : '—';
}

export default function AdminPremiumAccessPanel({ initialOverview }: { initialOverview: Overview }) {
  const [counts, setCounts] = useState<Counts>(initialOverview.counts);
  const [eventMode, setEventMode] = useState<EventMode>(initialOverview.eventMode);

  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('free');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoRevertAt, setAutoRevertAt] = useState('');
  const [busy, setBusy] = useState(false);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const abortRef = useRef<AbortController | null>(null);

  const refetchOverview = useCallback(async () => {
    const r = await apiJson<Overview>(API, { method: 'GET' });
    if (r.ok) {
      setCounts(r.data.counts);
      setEventMode(r.data.eventMode);
    }
  }, []);

  const fetchRoster = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      plan,
      query: debouncedQuery,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    fetch(`${API}/students?${params.toString()}`, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load roster (${res.status})`);
        return (await res.json()) as { students: RosterRow[]; total: number };
      })
      .then((data) => {
        setRows(Array.isArray(data.students) ? data.students : []);
        setTotal(Number(data.total) || 0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load roster.');
        setLoading(false);
      });
  }, [plan, debouncedQuery, page]);

  useEffect(() => {
    fetchRoster();
    return () => abortRef.current?.abort();
  }, [fetchRoster]);

  // Reset paging + selection whenever the filter or search changes.
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [plan, debouncedQuery]);

  async function afterMutation(message: string) {
    toast.success(message);
    setSelected(new Set());
    await Promise.all([refetchOverview(), Promise.resolve(fetchRoster())]);
  }

  async function grantUsers(userIds: string[]) {
    if (userIds.length === 0) return;
    setBusy(true);
    try {
      const r = await apiJson<{ usersAffected: number }>(`${API}/grant`, {
        method: 'POST',
        json: { mode: 'users', userIds, expiresAt: toIso(autoRevertAt) },
      });
      if (!r.ok) return toast.error(r.detail || 'Grant failed.');
      await afterMutation(`Granted Premium Pro to ${r.data.usersAffected} student${r.data.usersAffected === 1 ? '' : 's'}.`);
    } finally {
      setBusy(false);
    }
  }

  async function revokeUsers(userIds: string[]) {
    if (userIds.length === 0) return;
    setBusy(true);
    try {
      const r = await apiJson<{ usersAffected: number }>(`${API}/revoke`, {
        method: 'POST',
        json: { mode: 'users', userIds },
      });
      if (!r.ok) return toast.error(r.detail || 'Revoke failed.');
      await afterMutation(`Revoked Premium Pro from ${r.data.usersAffected} student${r.data.usersAffected === 1 ? '' : 's'}.`);
    } finally {
      setBusy(false);
    }
  }

  async function grantAllFree() {
    const scope = debouncedQuery ? `all ${counts.free} matching free students` : `all ${counts.free} free students`;
    if (!window.confirm(`Grant Premium Pro to ${scope}? Paid users are unaffected.${autoRevertAt ? `\nAuto-reverts at ${new Date(autoRevertAt).toLocaleString('en-IN')}.` : ''}`)) return;
    setBusy(true);
    try {
      const r = await apiJson<{ usersAffected: number; rowsInserted: number }>(`${API}/grant`, {
        method: 'POST',
        json: { mode: 'all_free', query: debouncedQuery || undefined, expiresAt: toIso(autoRevertAt) },
      });
      if (!r.ok) return toast.error(r.detail || 'Bulk grant failed.');
      await afterMutation(`Granted Premium Pro to ${r.data.usersAffected} student${r.data.usersAffected === 1 ? '' : 's'}.`);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAllComp() {
    if (!window.confirm(`Revoke admin-granted Premium Pro from ${counts.comp} student${counts.comp === 1 ? '' : 's'}? Paid users are unaffected.`)) return;
    setBusy(true);
    try {
      const r = await apiJson<{ usersAffected: number }>(`${API}/revoke`, {
        method: 'POST',
        json: { mode: 'all_comp', query: debouncedQuery || undefined },
      });
      if (!r.ok) return toast.error(r.detail || 'Bulk revoke failed.');
      await afterMutation(`Revoked Premium Pro from ${r.data.usersAffected} student${r.data.usersAffected === 1 ? '' : 's'}.`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleEventMode(next: boolean) {
    if (next && !window.confirm('Turn Event Mode ON? New students who sign up will be auto-granted Premium Pro until you turn it off.')) return;
    setBusy(true);
    try {
      const r = await apiJson<EventMode>(`${API}/event-mode`, {
        method: 'POST',
        json: { active: next, autoRevertAt: next ? toIso(autoRevertAt) : undefined },
      });
      if (!r.ok) return toast.error(r.detail || 'Failed to update Event Mode.');
      setEventMode(r.data);
      toast.success(next ? 'Event Mode is ON — new signups get Premium Pro.' : 'Event Mode is OFF.');
    } finally {
      setBusy(false);
    }
  }

  // Selection helpers (page-scoped; only free/comp rows are actionable in bulk).
  const selectableIds = rows.filter((r) => r.plan === 'free' || r.plan === 'comp').map((r) => r.id);
  const allPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedIds = [...selected];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
          <Crown className="w-6 h-6 text-emerald-500" /> Premium Pro Access
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grant free students the full Premium Pro plan and revert them. Real paying subscribers are protected and never affected.
        </p>
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ['Free', counts.free, 'text-muted-foreground'],
          ['Paid (protected)', counts.paid, 'text-amber-600 dark:text-amber-400'],
          ['Granted (comp)', counts.comp, 'text-emerald-600 dark:text-emerald-400'],
          ['Teacher grant', counts.teacher, 'text-blue-600 dark:text-blue-400'],
        ] as const).map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className={`text-2xl font-black mt-1 ${tone}`}>{value.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {/* Event Mode */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${eventMode.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Event Mode {eventMode.active ? '· ON' : '· OFF'}</p>
            <p className="text-xs text-muted-foreground">
              {eventMode.active
                ? `New signups are auto-granted Premium Pro${eventMode.autoRevertAt ? ` (auto-revert ${fmtDate(eventMode.autoRevertAt)})` : ''}.`
                : 'While ON, students who sign up are auto-granted Premium Pro.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => toggleEventMode(!eventMode.active)}
          disabled={busy}
          className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors ${
            eventMode.active
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {eventMode.active ? 'Turn Event Mode OFF' : 'Turn Event Mode ON'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl border border-border bg-card px-3 py-2 focus-within:border-emerald-500/50 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        </div>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanFilter)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card px-3 py-2">
          Auto-revert
          <input
            type="datetime-local"
            value={autoRevertAt}
            onChange={(e) => setAutoRevertAt(e.target.value)}
            className="bg-transparent outline-none text-foreground"
            title="Optional: grants made now auto-revert at this time"
          />
        </label>
      </div>

      {/* Bulk action bar */}
      {(plan === 'free' || plan === 'comp' || selectedIds.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-accent/40 px-4 py-3">
          {selectedIds.length > 0 ? (
            <>
              <span className="text-sm font-bold text-foreground">{selectedIds.length} selected</span>
              <button onClick={() => grantUsers(selectedIds)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
                Grant Pro to {selectedIds.length}
              </button>
              <button onClick={() => revokeUsers(selectedIds)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-bold hover:bg-rose-500/20 disabled:opacity-50">
                Revoke from {selectedIds.length}
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:underline ml-auto">Clear</button>
            </>
          ) : plan === 'free' ? (
            <button onClick={grantAllFree} disabled={busy || counts.free === 0} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50">
              Select all free students → Grant Pro{debouncedQuery ? ' (matching)' : ` (${counts.free})`}
            </button>
          ) : (
            <button onClick={revokeAllComp} disabled={busy || counts.comp === 0} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-bold hover:bg-rose-500/20 disabled:opacity-50">
              Revoke all granted ({counts.comp})
            </button>
          )}
          {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      {/* Roster */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allPageSelected} onChange={togglePage} disabled={selectableIds.length === 0} aria-label="Select page" />
              </th>
              <th className="text-left font-bold px-4 py-3">Name</th>
              <th className="text-left font-bold px-4 py-3">Email</th>
              <th className="text-left font-bold px-4 py-3">Plan</th>
              <th className="text-left font-bold px-4 py-3">Expiry</th>
              <th className="text-right font-bold px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No students found.</td></tr>
            ) : (
              rows.map((u) => {
                const actionable = u.plan === 'free' || u.plan === 'comp';
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleRow(u.id)} disabled={!actionable} aria-label={`Select ${u.email}`} />
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{u.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${PLAN_TONE[u.plan]}`}>{PLAN_LABEL[u.plan]}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.plan === 'comp' ? fmtDate(u.compExpiresAt) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {u.plan === 'free' ? (
                        <button onClick={() => grantUsers([u.id])} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">Grant Pro</button>
                      ) : u.plan === 'comp' ? (
                        <button onClick={() => revokeUsers([u.id])} disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 disabled:opacity-50">Revoke</button>
                      ) : u.plan === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold"><Lock className="w-3.5 h-3.5" /> Paid — protected</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-bold"><ShieldCheck className="w-3.5 h-3.5" /> Teacher grant</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} student${total === 1 ? '' : 's'}`}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-accent">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))} disabled={page + 1 >= totalPages || loading} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-accent">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
