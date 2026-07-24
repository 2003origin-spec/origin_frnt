"use client";

/**
 * Feature B — admin user lifecycle panel (/admin/users section). Search + filter
 * users by lifecycle status, revoke / unrevoke / delete them, and toggle whether
 * deleted identities may sign up again. Deleted rows are tombstones (retained
 * name/email/phone). Talks to /api/admin/users. Enforcement is server-side +
 * unconditional; these are the flag-gated admin actions.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { ShieldAlert, Trash2, RotateCcw, Ban, Search, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  role: string;
  accountStatus: "active" | "revoked" | "deleted";
  statusReason: string | null;
  statusChangedAt: string | null;
  joinedAt: string;
  isMainAdmin: boolean;
};

type ListResponse = { users: AdminUser[]; resignupAllowed: boolean };

const TABS = ["all", "active", "revoked", "deleted"] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLE: Record<AdminUser["accountStatus"], string> = {
  active: "bg-emerald-500/15 text-emerald-500",
  revoked: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  deleted: "bg-destructive/15 text-destructive",
};

export function AdminUserLifecyclePanel() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resignupAllowed, setResignupAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, startBusy] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: tab });
    if (query.trim()) params.set("q", query.trim());
    const res = await apiJson<ListResponse>(`/api/admin/users?${params.toString()}`);
    if (res.ok) {
      setUsers(res.data.users);
      setResignupAllowed(res.data.resignupAllowed);
    } else {
      toast.error(res.detail || "Failed to load users.");
    }
    setLoading(false);
  }, [tab, query]);

  useEffect(() => {
    // Intentional: (re)load the list on tab change (load also reads the current
    // query, deliberately not a dep so typing doesn't refetch on every keystroke).
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function act(user: AdminUser, action: "revoke" | "unrevoke" | "delete") {
    let reason: string | null = null;
    if (action === "delete") {
      if (!window.confirm(`Permanently delete ${user.name} (${user.email})?\n\nTheir data is purged but name/email/phone are retained to block re-signup. This cannot be undone.`)) {
        return;
      }
      reason = window.prompt("Reason (stored in the audit log):", "") ?? null;
    } else if (action === "revoke") {
      reason = window.prompt("Reason for revoking (audit log):", "") ?? null;
    } else if (!window.confirm(`Restore ${user.name} to active?`)) {
      return;
    }

    startBusy(async () => {
      const res = await apiJson<{ warnings?: string[] }>(`/api/admin/users/${user.id}/status`, {
        method: "POST",
        json: { action, reason },
      });
      if (res.ok) {
        toast.success(`User ${action === "unrevoke" ? "restored" : action + "d"}.`);
        (res.data.warnings ?? []).forEach((w) => toast.warning(w));
        await load();
      } else {
        toast.error(res.detail || `${action} failed.`);
      }
    });
  }

  function toggleResignup() {
    startBusy(async () => {
      const next = !resignupAllowed;
      const res = await apiJson<{ resignupAllowed: boolean }>(`/api/admin/users`, {
        method: "POST",
        json: { action: "setResignupAllowed", allow: next },
      });
      if (res.ok) {
        setResignupAllowed(res.data.resignupAllowed);
        toast.success(`Deleted-identity re-signup ${res.data.resignupAllowed ? "allowed" : "blocked"}.`);
      } else {
        toast.error(res.detail || "Could not update the setting.");
      }
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-500" /> User Lifecycle
          </h2>
          <p className="text-xs text-muted-foreground">Revoke or delete accounts. Deleted users can&apos;t log in or re-sign-up.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={resignupAllowed} onChange={toggleResignup} disabled={busy} className="h-4 w-4" />
          Allow deleted identities to sign up again
        </label>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="name / email / phone"
              className="h-9 w-56 rounded-xl border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button onClick={() => load()} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-2xl">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 px-3 font-medium">Role</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}{u.mobile ? ` · ${u.mobile}` : ""}</p>
                    {u.accountStatus !== "active" && u.statusReason && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">“{u.statusReason}”</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 capitalize text-muted-foreground">{u.role}{u.isMainAdmin ? " (main)" : ""}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold capitalize ${STATUS_STYLE[u.accountStatus]}`}>
                      {u.accountStatus}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {u.isMainAdmin || u.accountStatus === "deleted" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <>
                          {u.accountStatus === "revoked" ? (
                            <Button size="sm" variant="outline" onClick={() => act(u, "unrevoke")} disabled={busy} className="h-8 rounded-lg gap-1 text-xs">
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => act(u, "revoke")} disabled={busy} className="h-8 rounded-lg gap-1 text-xs text-amber-600 border-amber-500/30">
                              <Ban className="w-3.5 h-3.5" /> Revoke
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => act(u, "delete")} disabled={busy} className="h-8 rounded-lg gap-1 text-xs text-destructive border-destructive/30">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
