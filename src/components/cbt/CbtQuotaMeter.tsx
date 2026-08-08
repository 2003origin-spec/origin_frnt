"use client";

/**
 * The CBT navbar participation meter — "how much of my limit is set, and how
 * much have I used" (requirement R6), plus the "request more" flow behind a
 * popover so it is reachable from every page in the teacher app.
 *
 * The server-rendered state comes from the (teacher) layout; this component then
 * refreshes it on mount, whenever the tab regains focus, every 60s, and whenever
 * something in the app dispatches `cbt:quota-changed` (a room create, a code
 * reveal refusal, a completed request). Hidden entirely when the teacher has no
 * cap, so a grandfathered teacher sees exactly the navbar they had before.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mutateJson } from "@/lib/csrf";

import { CBT_QUOTA_CHANGED_EVENT, type CbtQuotaClientState } from "./quota-client";

const REFRESH_MS = 60_000;

function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

export function CbtQuotaMeter({ initial }: { initial: CbtQuotaClientState | null }) {
  const [state, setState] = useState<CbtQuotaClientState | null>(initial);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cbt/quota", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setState((await res.json()) as CbtQuotaClientState);
    } catch {
      // A meter that can't refresh keeps showing the last known numbers; the
      // server-side guards are authoritative either way.
    }
  }, []);

  useEffect(() => {
    // Intentional: re-read the meter on mount so a server-rendered number that
    // is already a page-navigation old (or absent) is corrected immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(CBT_QUOTA_CHANGED_EVENT, onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CBT_QUOTA_CHANGED_EVENT, onFocus);
    };
  }, [load]);

  // No cap (or the platform switch is off) → nothing to show.
  if (!state || !state.enforced || state.quota === null) return null;

  const { quota, used, blocked, nearLimit } = state;
  const pct = Math.min(100, Math.round(((state.usedFraction ?? 0) as number) * 100));
  const tone = blocked
    ? "text-destructive"
    : nearLimit
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
  const barTone = blocked ? "bg-destructive" : nearLimit ? "bg-amber-500" : "bg-primary";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="neu-raised hidden shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-transform hover:-translate-y-0.5 sm:flex"
          title="CBT participation limit"
        >
          {blocked ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <Users className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
          )}
          <span className="flex flex-col gap-1">
            <span className={`text-[11px] font-bold leading-none ${tone}`}>
              {blocked ? "Limit reached" : `${formatCount(used)} / ${formatCount(quota)}`}
            </span>
            <span
              className="block h-1 w-20 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Participations used"
              aria-valuenow={used}
              aria-valuemin={0}
              aria-valuemax={quota}
            >
              <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4">
        <QuotaDetails state={state} onChanged={load} />
      </PopoverContent>
    </Popover>
  );
}

function QuotaDetails({
  state,
  onChanged,
}: {
  state: CbtQuotaClientState;
  onChanged: () => Promise<void> | void;
}) {
  const quota = state.quota ?? 0;
  return (
    <>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Test participations
          {state.period.mode !== "none" ? (
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              {state.period.mode === "monthly"
                ? "monthly"
                : `every ${(state.period.periodDays ?? 30).toLocaleString("en-IN")}d`}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          One participation is counted for each student who <strong>starts</strong> a test in one of your
          rooms. Students who only wait in the lobby are never counted.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="neu-inset rounded-xl px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Limit</dt>
          <dd className="text-sm font-black text-foreground">{formatCount(quota)}</dd>
        </div>
        <div className="neu-inset rounded-xl px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Used</dt>
          <dd className="text-sm font-black text-foreground">{formatCount(state.used)}</dd>
        </div>
        <div className="neu-inset rounded-xl px-2 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Left</dt>
          <dd className="text-sm font-black text-foreground">{formatCount(state.remaining ?? 0)}</dd>
        </div>
      </dl>

      {state.period.end ? (
        <p className="text-[11px] text-muted-foreground">
          Renews on{" "}
          <strong className="text-foreground">
            {new Date(state.period.end).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
          {state.period.daysUntilReset !== null
            ? ` (${state.period.daysUntilReset === 0 ? "today" : `in ${state.period.daysUntilReset} day${state.period.daysUntilReset === 1 ? "" : "s"}`})`
            : ""}
          , when the count goes back to 0.
        </p>
      ) : null}

      {state.held > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {formatCount(state.held)} seat{state.held === 1 ? "" : "s"} reserved by students waiting in your
          open rooms.
        </p>
      ) : null}

      <CbtQuotaRequestForm state={state} onChanged={onChanged} />
    </>
  );
}

/**
 * The "request more" form. Shared by the navbar popover and the blocked-room
 * banner, so a teacher can ask from wherever they hit the wall.
 */
export function CbtQuotaRequestForm({
  state,
  onChanged,
  autoOpen = false,
}: {
  state: CbtQuotaClientState;
  onChanged: () => Promise<void> | void;
  /** Skip the "Request more" button and show the fields straight away. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [additional, setAdditional] = useState("");
  const [note, setNote] = useState("");
  const [busy, startBusy] = useTransition();

  const pending = state.pendingRequest;

  function submit() {
    const n = Number(additional);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("Enter how many more participations you need.");
      return;
    }
    startBusy(async () => {
      const res = await mutateJson("/api/cbt/quota", {
        method: "POST",
        body: JSON.stringify({ action: "request", additional: n, note: note.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        toast.error(data.detail ?? "Could not send the request.");
        return;
      }
      toast.success("Request sent. Our team will get back to you.");
      setOpen(false);
      setAdditional("");
      setNote("");
      await onChanged();
    });
  }

  function cancel(requestId: string) {
    startBusy(async () => {
      const res = await mutateJson("/api/cbt/quota", {
        method: "POST",
        body: JSON.stringify({ action: "cancel", requestId }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        toast.error(data.detail ?? "Could not withdraw the request.");
        return;
      }
      toast.success("Request withdrawn.");
      await onChanged();
    });
  }

  if (pending) {
    return (
      <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
        <p className="text-xs font-semibold text-foreground">Request sent</p>
        <p className="text-[11px] text-muted-foreground">
          You asked for {pending.requestedAdditional.toLocaleString("en-IN")} more participations. An admin
          will review it.
        </p>
        <SupportLine phone={state.supportPhone} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-lg px-2 text-[11px] text-muted-foreground"
          disabled={busy}
          onClick={() => cancel(pending.id)}
        >
          Withdraw request
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button size="sm" className="h-8 w-full rounded-xl text-xs" onClick={() => setOpen(true)}>
          Request more participations
        </Button>
        <SupportLine phone={state.supportPhone} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          How many more participations do you need?
        </span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={additional}
          onChange={(e) => setAdditional(e.target.value)}
          placeholder="e.g. 200"
          className="neu-inset h-9 rounded-xl bg-transparent px-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">Anything we should know? (optional)</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. Two more batches joining next month"
          className="neu-inset resize-none rounded-xl bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
        />
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 flex-1 gap-1.5 rounded-xl text-xs" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
          request
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-xl text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      <SupportLine phone={state.supportPhone} />
    </div>
  );
}

function SupportLine({ phone }: { phone: string | null }) {
  if (!phone) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Our team will reach out to discuss your participation count.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-muted-foreground">
      Or call us to discuss pricing:{" "}
      <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-semibold text-foreground hover:underline">
        {phone}
      </a>
    </p>
  );
}
