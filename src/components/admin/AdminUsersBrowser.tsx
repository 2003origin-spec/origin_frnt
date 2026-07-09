'use client';

/**
 * Admin user directory — industry-grade search over GET /api/admin/search?type=user.
 * Search-as-you-type is DEBOUNCED (queries the server only after the user pauses,
 * not on every keystroke) and each request is ABORTABLE, so a slower earlier
 * response can never clobber a newer one. Connects the previously orphaned admin
 * search endpoint (searchUsersService). Read-only inspect + filter by role.
 */

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Users as UsersIcon } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type Role = 'student' | 'teacher' | 'admin';
type RoleFilter = 'all' | Role;
type Plan = 'paid' | 'comp' | 'teacher' | 'free';
type PlanFilter = 'all' | 'free' | 'premium' | 'paid' | 'comp' | 'teacher';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  plan: Plan | null;
  workspaceMemberships: { workspaceId: string; workspaceName: string; role: string }[];
  createdAt: string;
};

const ROLE_TONE: Record<Role, string> = {
  student: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teacher: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const PLAN_TONE: Record<Plan, string> = {
  paid: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  comp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  teacher: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  free: 'bg-muted text-muted-foreground',
};
const PLAN_LABEL: Record<Plan, string> = { paid: 'Paid', comp: 'Granted', teacher: 'Teacher', free: 'Free' };

const PLAN_FILTERS: { value: PlanFilter; label: string }[] = [
  { value: 'all', label: 'All plans' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid premium' },
  { value: 'comp', label: 'Granted (comp)' },
  { value: 'teacher', label: 'Teacher grant' },
];

export function AdminUsersBrowser({ initialRole = 'all', initialPlan = 'all' }: { initialRole?: RoleFilter; initialPlan?: PlanFilter }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>(initialRole);
  const [planFilter, setPlanFilter] = useState<PlanFilter>(initialPlan);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the typed query so the server is hit only when the user pauses.
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request so responses can't arrive out of order.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ type: 'user', query: debouncedQuery, limit: '50' });
    if (role !== 'all') params.set('role', role);
    if (planFilter !== 'all') params.set('plan', planFilter);

    fetch(`/api/admin/search?${params.toString()}`, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return (await res.json()) as AdminUser[];
      })
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return; // superseded — ignore
        setError(err instanceof Error ? err.message : 'Search failed.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, role, planFilter]);

  // A query the user typed that hasn't been searched yet (debounce in flight).
  const pending = query.trim() !== debouncedQuery;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
          <UsersIcon className="w-6 h-6 text-emerald-500" /> User Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Search and inspect every account on the platform.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl border border-border bg-card px-3 py-2 focus-within:border-emerald-500/50 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            autoFocus
            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {(loading || pending) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
          title="Filter students by premium plan"
        >
          {PLAN_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-muted-foreground">
            <tr>
              <th className="text-left font-bold px-4 py-3">Name</th>
              <th className="text-left font-bold px-4 py-3">Email</th>
              <th className="text-left font-bold px-4 py-3">Role</th>
              <th className="text-left font-bold px-4 py-3">Plan</th>
              <th className="text-left font-bold px-4 py-3">Workspaces</th>
              <th className="text-left font-bold px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No users found.</td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-bold text-foreground">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROLE_TONE[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    {u.plan ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${PLAN_TONE[u.plan]}`}>{PLAN_LABEL[u.plan]}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.workspaceMemberships.length === 0
                      ? '—'
                      : u.workspaceMemberships.map((m) => m.workspaceName).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{loading ? 'Searching…' : `${rows.length} result${rows.length === 1 ? '' : 's'}.`}</p>
    </div>
  );
}
