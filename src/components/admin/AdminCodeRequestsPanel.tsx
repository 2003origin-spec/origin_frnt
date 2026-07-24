"use client";

/**
 * Admin console for Feature A — teacher code-access requests. Lists requests by
 * status, lets an admin set a quota + AI decision and approve/reject, and edits
 * the global support phone (D4). Talks to /api/admin/teacher-code-requests.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { KeyRound, Check, X, Phone, Loader2, RefreshCw, AlertTriangle, Search, Users, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import { toast } from "sonner";

type CodeRequest = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: "personal" | "institute";
  ownerName: string | null;
  ownerEmail: string | null;
  requestedStudentCount: number;
  aiAccess: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  grantedQuota: number | null;
  connectedStudents: number;
  currentQuota: number | null;
  codeAccessStatus: string;
  createdAt: string;
  decidedAt: string | null;
};

type ListResponse = { requests: CodeRequest[]; supportPhone: string | null };

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];

export function AdminCodeRequestsPanel() {
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [supportPhone, setSupportPhone] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, startBusy] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiJson<ListResponse>(`/api/admin/teacher-code-requests?status=${tab}`);
    if (res.ok) {
      setRequests(res.data.requests);
      setSupportPhone(res.data.supportPhone);
      setPhoneDraft(res.data.supportPhone ?? "");
    } else {
      toast.error(res.detail || "Failed to load requests.");
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    // Intentional: (re)fetch the request list when the status tab changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function savePhone() {
    startBusy(async () => {
      const res = await apiJson<{ supportPhone: string | null }>(`/api/admin/teacher-code-requests`, {
        method: "POST",
        json: { action: "setSupportPhone", phone: phoneDraft.trim() || null },
      });
      if (res.ok) {
        setSupportPhone(res.data.supportPhone);
        toast.success("Support phone updated.");
      } else {
        toast.error(res.detail || "Could not update phone.");
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-emerald-500" /> Teacher Code Access
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve teacher requests with a student quota and AI decision. The code activates on approval and
          auto-revokes when the quota fills.
        </p>
      </header>

      {/* Support phone */}
      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-emerald-500" /> Support phone shown to teachers
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="+91-XXXXXXXXXX"
            className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <Button onClick={savePhone} disabled={busy} className="h-10 rounded-xl gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Currently: {supportPhone ? <span className="font-mono">{supportPhone}</span> : <em>not set</em>}
        </p>
      </div>

      {/* Manage an existing teacher directly (no request needed) */}
      <WorkspaceManageSection />

      {/* Tabs */}
      <div className="flex items-center gap-2">
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
        <button onClick={() => load()} className="ml-auto p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed rounded-2xl">
          No {tab === "all" ? "" : tab} requests.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} onDone={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request: r, onDone }: { request: CodeRequest; onDone: () => void }) {
  const [quota, setQuota] = useState(String(r.grantedQuota ?? r.requestedStudentCount));
  const [aiAccess, setAiAccess] = useState(r.aiAccess);
  const [note, setNote] = useState("");
  const [busy, startBusy] = useTransition();

  const quotaNum = Number(quota);
  const belowConnected = Number.isFinite(quotaNum) && quotaNum < r.connectedStudents;

  function approve() {
    if (!Number.isInteger(quotaNum) || quotaNum <= 0) {
      toast.error("Enter a valid quota.");
      return;
    }
    startBusy(async () => {
      const res = await apiJson<{ displayCode: string; warning: string | null }>(
        `/api/admin/teacher-code-requests/${r.id}`,
        {
          method: "POST",
          json: { action: "approve", grantedQuota: quotaNum, aiAccess, note: note.trim() || null },
        },
      );
      if (res.ok) {
        if (res.data.warning) toast.warning(res.data.warning);
        else toast.success(`Approved — code ${res.data.displayCode} is active.`);
        onDone();
      } else {
        toast.error(res.detail || "Approve failed.");
      }
    });
  }

  function reject() {
    startBusy(async () => {
      const res = await apiJson(`/api/admin/teacher-code-requests/${r.id}`, {
        method: "POST",
        json: { action: "reject", note: note.trim() || null },
      });
      if (res.ok) {
        toast.success("Request rejected.");
        onDone();
      } else {
        toast.error(res.detail || "Reject failed.");
      }
    });
  }

  const pending = r.status === "pending";

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {r.workspaceName}{" "}
            <span className="text-xs font-medium text-muted-foreground capitalize">({r.workspaceType})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {r.ownerName ?? "—"} · {r.ownerEmail ?? "—"}
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-bold capitalize ${
            r.status === "pending"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : r.status === "approved"
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {r.status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Requested" value={`${r.requestedStudentCount}`} />
        <Stat label="AI requested" value={r.aiAccess ? "Yes" : "No"} />
        <Stat label="Connected now" value={`${r.connectedStudents}`} />
        <Stat label="Current quota" value={r.currentQuota === null ? "—" : `${r.currentQuota}`} />
      </div>

      {pending && (
        <div className="pt-2 border-t space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Grant quota</span>
              <input
                type="number"
                min={1}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="h-9 w-28 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">AI access</span>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant={aiAccess ? "default" : "outline"} onClick={() => setAiAccess(true)} className="h-9 rounded-xl">
                  With AI
                </Button>
                <Button type="button" size="sm" variant={!aiAccess ? "default" : "outline"} onClick={() => setAiAccess(false)} className="h-9 rounded-xl">
                  Without AI
                </Button>
              </div>
            </div>
          </div>

          {belowConnected && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Quota is below the {r.connectedStudents} students already connected — the code will stay disabled for new joins.
            </p>
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (sent to the teacher on reject)"
            className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
          />

          <div className="flex items-center gap-2">
            <Button onClick={approve} disabled={busy} className="h-9 rounded-xl gap-1.5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
            </Button>
            <Button onClick={reject} disabled={busy} variant="outline" className="h-9 rounded-xl gap-1.5 text-destructive border-destructive/30">
              <X className="w-4 h-4" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

// ─── Direct-manage: set a quota on an existing (grandfathered) teacher ──────────

type WorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  workspaceType: "personal" | "institute";
  ownerName: string | null;
  ownerEmail: string | null;
  codeAccessStatus: string;
  studentQuota: number | null;
  activeCode: string | null;
  connectedStudents: number;
};

function WorkspaceManageSection() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ view: "workspaces" });
    if (query.trim()) params.set("q", query.trim());
    const res = await apiJson<{ workspaces: WorkspaceRow[] }>(
      `/api/admin/teacher-code-requests?${params.toString()}`,
    );
    if (res.ok) setRows(res.data.workspaces);
    else toast.error(res.detail || "Failed to load teachers.");
    setLoading(false);
  }, [query]);

  useEffect(() => {
    // Intentional: initial load on mount; searches fire on Enter / the button.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="w-4 h-4 text-emerald-500" /> Manage an existing teacher
        </p>
        <p className="text-xs text-muted-foreground">
          Set a student quota on any teacher/institute directly — no request needed. (AI access is managed in AI Access.)
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by teacher / institute name or owner email"
            className="h-9 w-full rounded-xl border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" onClick={() => load()} className="h-9 rounded-xl gap-1.5">
          <Search className="w-4 h-4" /> Search
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">No teachers found.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <WorkspaceRowCard key={r.workspaceId} row={r} onDone={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceRowCard({ row, onDone }: { row: WorkspaceRow; onDone: () => void }) {
  const [quota, setQuota] = useState(row.studentQuota !== null ? String(row.studentQuota) : "");
  const [busy, startBusy] = useTransition();

  function manage(op: "setQuota" | "removeQuota" | "revoke") {
    if (op === "revoke" && !window.confirm(`Disable ${row.workspaceName}'s join code? Existing students keep access; no new students can join.`)) {
      return;
    }
    let quotaNum: number | undefined;
    if (op === "setQuota") {
      quotaNum = Number(quota);
      if (!Number.isInteger(quotaNum) || quotaNum <= 0) {
        toast.error("Enter a valid quota.");
        return;
      }
    }
    startBusy(async () => {
      const res = await apiJson<{ warning?: string | null; displayCode?: string }>(
        `/api/admin/teacher-code-requests`,
        { method: "POST", json: { action: "manageWorkspace", workspaceId: row.workspaceId, op, quota: quotaNum } },
      );
      if (res.ok) {
        if (res.data?.warning) toast.warning(res.data.warning);
        else
          toast.success(
            op === "revoke"
              ? "Code disabled."
              : op === "removeQuota"
              ? "Set to unlimited."
              : `Quota set${res.data?.displayCode ? ` — code ${res.data.displayCode}` : ""}.`,
          );
        onDone();
      } else {
        toast.error(res.detail || "Action failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">
          {row.workspaceName}{" "}
          <span className="text-xs font-medium text-muted-foreground capitalize">({row.workspaceType})</span>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {row.ownerName ?? "—"} · {row.ownerEmail ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Code: {row.activeCode ? <span className="font-mono">{row.activeCode}</span> : <em>none</em>}
          {" · "}
          {row.connectedStudents} connected · quota: {row.studentQuota === null ? "unlimited" : row.studentQuota} ·{" "}
          {row.codeAccessStatus}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={quota}
          onChange={(e) => setQuota(e.target.value)}
          placeholder="quota"
          className="h-8 w-20 rounded-lg border bg-background px-2 text-sm outline-none focus:border-primary"
        />
        <Button size="sm" onClick={() => manage("setQuota")} disabled={busy} className="h-8 rounded-lg text-xs">
          Set
        </Button>
        <Button size="sm" variant="outline" onClick={() => manage("removeQuota")} disabled={busy} className="h-8 rounded-lg text-xs">
          Unlimited
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => manage("revoke")}
          disabled={busy}
          className="h-8 rounded-lg text-xs text-destructive border-destructive/30 gap-1"
        >
          <Ban className="w-3.5 h-3.5" /> Revoke
        </Button>
      </div>
    </div>
  );
}
