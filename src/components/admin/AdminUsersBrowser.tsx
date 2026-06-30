'use client';

/**
 * Admin user directory — live search over GET /api/admin/search?type=user.
 * Replaces the old mock `mockUsers` table and connects the previously orphaned
 * admin search endpoint (searchUsersService). Read-only inspect + filter by role.
 */

import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, Users as UsersIcon } from 'lucide-react';

type Role = 'student' | 'teacher' | 'admin';
type RoleFilter = 'all' | Role;

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspaceMemberships: { workspaceId: string; workspaceName: string; role: string }[];
  createdAt: string;
};

const ROLE_TONE: Record<Role, string> = {
  student: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teacher: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function AdminUsersBrowser({ initialRole = 'all' }: { initialRole?: RoleFilter }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>(initialRole);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: 'user', query, limit: '100' });
      if (role !== 'all') params.set('role', role);
      const res = await fetch(`/api/admin/search?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as AdminUser[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  // Initial load + reload on role change.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
          <UsersIcon className="w-6 h-6 text-emerald-500" /> User Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Search and inspect every account on the platform.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-xl border border-border bg-card px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
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
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-muted-foreground">
            <tr>
              <th className="text-left font-bold px-4 py-3">Name</th>
              <th className="text-left font-bold px-4 py-3">Email</th>
              <th className="text-left font-bold px-4 py-3">Role</th>
              <th className="text-left font-bold px-4 py-3">Workspaces</th>
              <th className="text-left font-bold px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No users found.</td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-bold text-foreground">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROLE_TONE[u.role]}`}>{u.role}</span>
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
      <p className="text-xs text-muted-foreground">{rows.length} result{rows.length === 1 ? '' : 's'}.</p>
    </div>
  );
}
