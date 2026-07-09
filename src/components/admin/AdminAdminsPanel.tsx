'use client';

/**
 * Admin Control Plane — admin management (main-admin only). Create sub-admins by
 * name + email; sub-admins log in via OTP and get every admin tool except this
 * one. The main admin can unassign / delete any sub-admin.
 */

import { useState } from 'react';
import { ShieldCheck, Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';

type Admin = { id: string; name: string; email: string; isMainAdmin: boolean; joinedAt: string };

export function AdminAdminsPanel({ initial }: { initial: Admin[] }) {
  const [admins, setAdmins] = useState<Admin[]>(initial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !email.trim()) return toast.error('Enter a name and email.');
    setBusy(true);
    try {
      const res = await mutateJson('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Failed (${res.status})`);
      const created = (await res.json()) as Admin;
      setAdmins((prev) => [...prev, created]);
      toast.success(`${created.email} can now sign in as an admin (OTP).`);
      setName(''); setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Admin) {
    if (!confirm(`Remove admin access for ${a.email}?`)) return;
    try {
      const res = await mutateJson(`/api/admin/admins?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `Failed (${res.status})`);
      setAdmins((prev) => prev.filter((x) => x.id !== a.id));
      toast.success('Admin removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" /> Admins
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Create sub-admins by name + email. They sign in with OTP and can use every admin tool except this one.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2"><UserPlus className="w-4 h-4 text-emerald-500" /> Add sub-admin</h3>
        <div className="flex flex-wrap gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="flex-1 min-w-[160px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <button onClick={create} disabled={busy} className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-muted-foreground">
            <tr>
              <th className="text-left font-bold px-4 py-3">Name</th>
              <th className="text-left font-bold px-4 py-3">Email</th>
              <th className="text-left font-bold px-4 py-3">Role</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-3 font-bold text-foreground">{a.name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${a.isMainAdmin ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                    {a.isMainAdmin ? 'Main admin' : 'Sub-admin'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {a.isMainAdmin ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <button onClick={() => remove(a)} className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline text-sm font-bold">
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
