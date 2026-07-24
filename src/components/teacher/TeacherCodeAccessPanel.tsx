"use client";

/**
 * Feature A — teacher-side code-access panel. Renders one of:
 *   • the live join code (Copy / Share) when access is granted,
 *   • a "quota filled" disclaimer + support phone when the cap is reached,
 *   • a "request pending" card (with Cancel) after a request is sent,
 *   • a "Request Code Access" button + form (student count + AI toggle) otherwise.
 * Fetches /api/teacher/workspaces/[id]/code-access on mount. Only mounted when
 * the teacherCodeApproval flag is on (the parent decides). See
 * V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, MessageSquare, Phone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import { toast } from "sonner";

type CodeAccessState = {
  codeAccessStatus: string;
  studentQuota: number | null;
  connectedStudents: number;
  quotaFilled: boolean;
  activeCode: { id: string; displayCode: string } | null;
  pendingRequest: { id: string; requestedStudentCount: number; aiAccess: boolean; createdAt: string } | null;
  supportPhone: string | null;
};

function SupportLine({ phone }: { phone: string | null }) {
  if (!phone) {
    return (
      <p className="text-xs text-muted-foreground">
        Our team will reach out to discuss pricing and your student count.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Phone className="w-3.5 h-3.5" />
      Discuss pricing / students and get your code:{" "}
      <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-semibold text-foreground hover:underline">
        {phone}
      </a>
    </p>
  );
}

export function TeacherCodeAccessPanel({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<CodeAccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [count, setCount] = useState("");
  const [aiAccess, setAiAccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, startBusy] = useTransition();

  const load = useCallback(async () => {
    const res = await apiJson<CodeAccessState>(`/api/teacher/workspaces/${workspaceId}/code-access`);
    if (res.ok) setState(res.data);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    // Intentional: fetch code-access state on mount / when the workspace changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp(code: string) {
    const url = `${window.location.origin}/join?code=${code}`;
    const text = `Join my ORIGIN learning workspace using this code: *${code}* or click here: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  }

  function submitRequest() {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Enter how many students you want to connect with.");
      return;
    }
    startBusy(async () => {
      const res = await apiJson(`/api/teacher/workspaces/${workspaceId}/code-access`, {
        method: "POST",
        json: { action: "request", studentCount: n, aiAccess },
      });
      if (res.ok) {
        toast.success("Request sent! Our team will reach out.");
        setShowForm(false);
        setCount("");
        setAiAccess(false);
        await load();
        router.refresh();
      } else {
        toast.error(res.detail || "Could not send the request.");
      }
    });
  }

  function cancelRequest(id: string) {
    startBusy(async () => {
      const res = await apiJson(`/api/teacher/workspaces/${workspaceId}/code-access`, {
        method: "POST",
        json: { action: "cancel", requestId: id },
      });
      if (res.ok) {
        toast.success("Request withdrawn.");
        await load();
        router.refresh();
      } else {
        toast.error(res.detail || "Could not cancel the request.");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border rounded-xl bg-card text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading code access…
      </div>
    );
  }
  if (!state) return null;

  // 1) Active code granted.
  if (state.activeCode) {
    const code = state.activeCode.displayCode;
    return (
      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 border rounded-xl bg-card w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Join Code:</span>
            <span className="font-mono font-bold text-primary text-lg tracking-widest">{code}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => copyCode(code)} className="flex-1 sm:flex-initial gap-1.5 h-10 rounded-xl">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => shareWhatsApp(code)} className="flex-1 sm:flex-initial gap-1.5 h-10 rounded-xl hover:text-emerald-500 hover:border-emerald-500/30">
              <MessageSquare className="w-4 h-4" /> Share
            </Button>
          </div>
        </div>
        {state.studentQuota !== null && (
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            {state.connectedStudents} / {state.studentQuota} students connected
          </p>
        )}
      </div>
    );
  }

  // 2) Quota filled — code disabled.
  if (state.quotaFilled) {
    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-md rounded-xl border border-amber-500/40 bg-amber-500/[0.04] p-4">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Your code is disabled — your {state.studentQuota}-student quota is filled.
        </p>
        <p className="text-xs text-muted-foreground">
          To connect more students, request more seats below and contact the team.
        </p>
        <SupportLine phone={state.supportPhone} />
        <div>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 h-9 rounded-xl mt-1">
            <KeyRound className="w-4 h-4" /> Request more
          </Button>
        </div>
        {showForm && <RequestForm {...{ count, setCount, aiAccess, setAiAccess, submitRequest, busy, onClose: () => setShowForm(false) }} />}
      </div>
    );
  }

  // 3) Request pending.
  if (state.pendingRequest) {
    const pr = state.pendingRequest;
    return (
      <div className="flex flex-col gap-2 w-full sm:max-w-md rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-500" /> Thanks for sending the request!
        </p>
        <p className="text-xs text-muted-foreground">
          Requested <span className="font-semibold text-foreground">{pr.requestedStudentCount}</span> students ·{" "}
          {pr.aiAccess ? "with AI access" : "without AI access"}.
        </p>
        <SupportLine phone={state.supportPhone} />
        <div>
          <Button variant="ghost" size="sm" onClick={() => cancelRequest(pr.id)} disabled={busy} className="h-8 rounded-xl text-xs text-muted-foreground">
            Withdraw request
          </Button>
        </div>
      </div>
    );
  }

  // 4) No code, no request → request access.
  return (
    <div className="flex flex-col gap-2 w-full sm:max-w-md">
      {!showForm ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Your institute code isn&apos;t active yet</p>
          <p className="text-xs text-muted-foreground">
            Request code access to start connecting students. The team will confirm your student count and pricing.
          </p>
          <div>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 h-9 rounded-xl mt-1">
              <KeyRound className="w-4 h-4" /> Request Code Access
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <RequestForm {...{ count, setCount, aiAccess, setAiAccess, submitRequest, busy, onClose: () => setShowForm(false) }} />
        </div>
      )}
    </div>
  );
}

function RequestForm({
  count,
  setCount,
  aiAccess,
  setAiAccess,
  submitRequest,
  busy,
  onClose,
}: {
  count: string;
  setCount: (v: string) => void;
  aiAccess: boolean;
  setAiAccess: (v: boolean) => void;
  submitRequest: () => void;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 mt-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Total number of students you want to connect with</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="e.g. 50"
          className="h-10 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">AI access for these students</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={aiAccess ? "default" : "outline"}
            size="sm"
            onClick={() => setAiAccess(true)}
            className="flex-1 h-9 rounded-xl"
          >
            With AI access
          </Button>
          <Button
            type="button"
            variant={!aiAccess ? "default" : "outline"}
            size="sm"
            onClick={() => setAiAccess(false)}
            className="flex-1 h-9 rounded-xl"
          >
            Without AI access
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submitRequest} disabled={busy} className="gap-1.5 h-9 rounded-xl">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send request
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} className="h-9 rounded-xl text-muted-foreground">
          Cancel
        </Button>
      </div>
    </div>
  );
}
