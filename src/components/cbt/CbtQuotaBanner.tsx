"use client";

/**
 * The "your quota limit is full" notice (requirement R4). Rendered above the room
 * list and the room console, so a teacher who hits the wall sees why their link
 * and code stopped working and can request more without leaving the page.
 *
 * Three states, in order of severity:
 *   • blocked   — the cap is spent: rooms, links and codes are all refused.
 *   • no_seats  — cap not spent, but every remaining seat is reserved by students
 *                 already waiting in an open room.
 *   • nearLimit — a heads-up at 80%, no blocking.
 * Renders nothing otherwise (including for a teacher with no cap at all).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { CBT_QUOTA_CHANGED_EVENT, type CbtQuotaClientState } from "./quota-client";
import { CbtQuotaRequestForm } from "./CbtQuotaMeter";

export function CbtQuotaBanner({ initial }: { initial: CbtQuotaClientState | null }) {
  const [state, setState] = useState<CbtQuotaClientState | null>(initial);
  // Only toast the first time we observe the blocked flip in this tab, so a 60s
  // refresh doesn't nag. A ref, not state: nothing renders from it, and it must
  // not trigger a re-render of its own.
  const toastedRef = useRef(initial?.blocked ?? false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cbt/quota", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setState((await res.json()) as CbtQuotaClientState);
    } catch {
      // Keep the last known state; the server-side guards are authoritative.
    }
  }, []);

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(CBT_QUOTA_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener(CBT_QUOTA_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [load]);

  useEffect(() => {
    if (state?.blocked && !toastedRef.current) {
      toastedRef.current = true;
      toast.error("Participation limit reached", {
        description: "Your room links and codes are blocked. Request more participations to continue.",
      });
    }
  }, [state?.blocked]);

  if (!state || !state.enforced || state.quota === null) return null;

  const quota = state.quota.toLocaleString("en-IN");
  const used = state.used.toLocaleString("en-IN");

  const renewsOn = state.period.end
    ? new Date(state.period.end).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const inDays = state.period.daysUntilReset;

  if (state.blocked) {
    return (
      <section
        role="alert"
        className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/[0.06] p-4"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-destructive">
              Your participation limit is full — {used} of {quota} used
              {state.period.mode !== "none" ? " this cycle" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Your room links and room codes are blocked, and you can&apos;t open new rooms. Tests already
              running are not affected and will finish normally.
              {renewsOn ? (
                <>
                  {" "}
                  Your allowance renews on <strong className="text-foreground">{renewsOn}</strong>
                  {inDays !== null
                    ? ` (${inDays === 0 ? "today" : `in ${inDays} day${inDays === 1 ? "" : "s"}`})`
                    : ""}
                  , when the count returns to 0 and your links start working again. Need them sooner?
                  Request more below.
                </>
              ) : (
                " Request more participations to continue."
              )}
            </p>
          </div>
        </div>
        <div className="max-w-md">
          <CbtQuotaRequestForm state={state} onChanged={load} autoOpen={!state.pendingRequest} />
        </div>
      </section>
    );
  }

  if (state.status === "no_seats") {
    return (
      <section role="status" className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              No free seats — every remaining participation is reserved
            </p>
            <p className="text-xs text-muted-foreground">
              {used} of {quota} used, and the {state.held.toLocaleString("en-IN")} student
              {state.held === 1 ? "" : "s"} already waiting in your open rooms hold the rest. They can all sit
              the test; no new student can join until those rooms finish.
            </p>
          </div>
        </div>
        <div className="max-w-md">
          <CbtQuotaRequestForm state={state} onChanged={load} />
        </div>
      </section>
    );
  }

  if (state.nearLimit) {
    return (
      <section role="status" className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/40 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          You&apos;ve used <strong className="text-foreground">{used}</strong> of your {quota} test
          participations{state.period.mode !== "none" ? " this cycle" : ""}.
          {renewsOn ? ` They renew on ${renewsOn}.` : ""} Request more before you run out — open the meter in
          the top bar.
        </p>
      </section>
    );
  }

  return null;
}
