"use client";

/**
 * Admin → CBT → participation quotas.
 *
 * Two sections:
 *   1. the pending "I need more participations" queue — approve with a new TOTAL
 *      cap (pre-filled with current + requested) or reject with a note;
 *   2. every CBT teacher with their cap, permanent usage, reserved seats and
 *      derived state, editable inline. Clearing the field removes the cap.
 *
 * Usage is deliberately immutable: deleting a room does NOT give participations
 * back, so the only way to give a teacher room to breathe is to raise the cap.
 * That is spelled out in the UI rather than left as folklore.
 */

import { useCallback, useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { csrfHeaders } from "@/lib/csrf";
import type { CbtQuotaOverview, CbtQuotaRequestRow, CbtTeacherQuotaRow } from "@/server/cbt/cbt-quota-admin-service";

const STATUS_STYLE: Record<CbtTeacherQuotaRow["status"], { label: string; className: string }> = {
  unlimited: {
    label: "no cap",
    className: "bg-muted text-muted-foreground",
  },
  granted: {
    label: "within limit",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  no_seats: {
    label: "no free seats",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  exhausted: {
    label: "limit full",
    className: "bg-destructive/15 text-destructive",
  },
};

function n(value: number): string {
  return value.toLocaleString("en-IN");
}

export function AdminCbtQuotaPanel({ initial }: { initial: CbtQuotaOverview }) {
  const [data, setData] = useState<CbtQuotaOverview>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/cbt/teachers", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json().catch(() => ({}))) as { quota?: CbtQuotaOverview };
    if (body.quota) setData(body.quota);
  }, []);

  /** Every mutation goes through the one PATCH endpoint. */
  const patch = useCallback(
    async (body: Record<string, unknown>, successMessage: string) => {
      setError(null);
      setNotice(null);
      const res = await fetch("/api/admin/cbt/teachers", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { detail?: string; warning?: string | null };
      if (!res.ok) {
        setError(payload.detail ?? `Update failed (${res.status})`);
        return false;
      }
      setNotice(payload.warning ? `${successMessage} ${payload.warning}` : successMessage);
      await reload();
      return true;
    },
    [reload],
  );

  const filtered = data.teachers.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return t.email.toLowerCase().includes(q) || (t.displayName ?? "").toLowerCase().includes(q);
  });

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Participation quotas</h2>
        <p className="text-sm text-muted-foreground">
          One participation is counted for each student who <strong>starts</strong> a test in that
          teacher&apos;s room — lobby-only students are never counted, and a participation is counted once
          per student however many times they rejoin. Deleting a room does <strong>not</strong> give
          participations back, so raise the cap instead.
        </p>
        <p className="text-sm text-muted-foreground">
          Set <strong>monthly</strong> (or <strong>every N days</strong>) with a start date to make the
          allowance renew like a subscription: on each renewal the counter goes back to 0 and any blocked
          room links start working again. <strong>One-off</strong> means the cap never renews. Past cycles
          stay on record — renewing only moves the window usage is counted over.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/[0.06] p-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3 text-xs text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {data.requests.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Pending requests
            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {data.requests.length}
            </span>
          </h3>
          <ul className="space-y-2">
            {data.requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                busy={isPending}
                onDecide={(body, message) => startTransition(() => void patch(body, message))}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Teachers</h3>
          <label className="neu-inset flex items-center gap-2 rounded-xl px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email or name"
              className="w-48 bg-transparent text-xs text-foreground outline-none"
            />
          </label>
        </div>

        <div className="neu-raised overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Teacher</th>
                <th className="px-4 py-3 font-medium">Limit</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Left</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 text-right font-medium">Set limit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No matching CBT teachers.
                  </td>
                </tr>
              ) : (
                filtered.map((teacher) => (
                  <TeacherQuotaRow
                    /* The stored policy is part of the key on purpose: a reload
                       that brings new values remounts the row, so its inputs
                       re-initialise without a prop-to-state effect. */
                    key={`${teacher.teacherId}:${teacher.quota}:${teacher.period.mode}:${teacher.period.periodDays}:${teacher.period.anchor}`}
                    teacher={teacher}
                    busy={isPending}
                    onSave={(quota, reset) =>
                      startTransition(
                        () =>
                          void patch(
                            {
                              action: "set_quota",
                              id: teacher.teacherId,
                              quota,
                              reset: {
                                mode: reset.mode,
                                periodDays: reset.periodDays,
                                // Send a plain date; the server anchors it and
                                // rejects anything in the future.
                                anchor: reset.mode === "none" ? null : reset.anchor || null,
                              },
                            },
                            quota === null
                              ? `Cap removed for ${teacher.email}.`
                              : `Limit set to ${n(quota)} for ${teacher.email}.`,
                          ),
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RequestCard({
  request,
  busy,
  onDecide,
}: {
  request: CbtQuotaRequestRow;
  busy: boolean;
  onDecide: (body: Record<string, unknown>, message: string) => void;
}) {
  const [total, setTotal] = useState(String(request.proposedTotal));
  const [note, setNote] = useState("");

  return (
    <li className="neu-raised space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {request.displayName ?? request.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">{request.email}</p>
          <p className="text-xs text-muted-foreground">
            Wants <strong className="text-foreground">+{n(request.requestedAdditional)}</strong> participations ·
            currently {request.currentQuota === null ? "no cap" : n(request.currentQuota)} with{" "}
            {n(request.currentUsed)} used · asked {new Date(request.createdAt).toLocaleDateString()}
          </p>
          {request.note ? (
            <p className="mt-1 rounded-lg bg-muted/50 px-2 py-1 text-xs italic text-muted-foreground">
              “{request.note}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">New total limit</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="neu-inset h-9 w-32 rounded-xl bg-transparent px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Note to the teacher (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Shown with the decision"
            className="neu-inset h-9 rounded-xl bg-transparent px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <Button
          size="sm"
          className="h-9 gap-1.5 rounded-xl shadow-lg shadow-primary/20"
          disabled={busy}
          onClick={() => {
            const parsedTotal = Number(total);
            onDecide(
              {
                action: "approve_quota",
                requestId: request.id,
                grantedQuota: parsedTotal,
                note: note.trim() || null,
              },
              `Approved — ${request.email} now has a limit of ${n(parsedTotal)}.`,
            );
          }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="neu-raised h-9 gap-1.5 rounded-xl border-0 shadow-none"
          disabled={busy}
          onClick={() =>
            onDecide(
              { action: "reject_quota", requestId: request.id, note: note.trim() || null },
              `Rejected the request from ${request.email}.`,
            )
          }
        >
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </li>
  );
}

/** `YYYY-MM-DD` for a `<input type="date">`, in the viewer's local timezone. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayInput(): string {
  return toDateInput(new Date().toISOString());
}

function TeacherQuotaRow({
  teacher,
  busy,
  onSave,
}: {
  teacher: CbtTeacherQuotaRow;
  busy: boolean;
  onSave: (quota: number | null, reset: ResetDraft) => void;
}) {
  // These initialise from the stored row. Re-syncing after a reload is handled
  // by REMOUNTING the row (the parent's key includes the stored policy), which
  // is why there is no prop-to-state effect here.
  const [draft, setDraft] = useState(teacher.quota === null ? "" : String(teacher.quota));
  const [mode, setMode] = useState<CbtTeacherQuotaRow["period"]["mode"]>(teacher.period.mode);
  const [days, setDays] = useState(String(teacher.period.periodDays ?? 30));
  const [anchor, setAnchor] = useState(toDateInput(teacher.period.anchor) || todayInput());

  const trimmed = draft.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const quotaInvalid = parsed !== null && (!Number.isInteger(parsed) || parsed <= 0);
  const daysNum = Number(days);
  const daysInvalid = mode === "days" && (!Number.isInteger(daysNum) || daysNum <= 0);
  // An anchor in the future would leave a window in which tests run uncharged.
  const anchorInvalid = mode !== "none" && (!anchor || anchor > todayInput());
  const invalid = quotaInvalid || daysInvalid || anchorInvalid;

  const dirty =
    (teacher.quota === null ? "" : String(teacher.quota)) !== trimmed ||
    mode !== teacher.period.mode ||
    (mode === "days" && String(teacher.period.periodDays ?? 30) !== days) ||
    (mode !== "none" && (toDateInput(teacher.period.anchor) || todayInput()) !== anchor);

  const style = STATUS_STYLE[teacher.status];

  return (
    <tr className="border-b border-border/40 last:border-0 align-top">
      <td className="px-4 py-3">
        <p className="text-foreground">{teacher.displayName ?? teacher.email}</p>
        {teacher.displayName ? <p className="text-xs text-muted-foreground">{teacher.email}</p> : null}
        {teacher.teacherStatus === "disabled" ? (
          <span className="text-xs text-muted-foreground">disabled</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{teacher.quota === null ? "—" : n(teacher.quota)}</td>
      <td className="px-4 py-3">
        <span className="font-semibold text-foreground">{n(teacher.used)}</span>
        {teacher.period.mode !== "none" && teacher.lifetimeUsed !== teacher.used ? (
          <span className="block text-xs text-muted-foreground">{n(teacher.lifetimeUsed)} all-time</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{teacher.held > 0 ? n(teacher.held) : "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {teacher.remaining === null ? "∞" : n(teacher.remaining)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
          {teacher.status === "exhausted" ? <AlertTriangle className="h-3 w-3" /> : null}
          {style.label}
        </span>
        {teacher.pendingRequestId ? (
          <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            +{n(teacher.pendingRequestAdditional ?? 0)} requested
          </span>
        ) : null}
        {teacher.period.end ? (
          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <RotateCcw className="h-3 w-3" />
            renews {new Date(teacher.period.end).toLocaleDateString()}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="no cap"
              title="Leave empty for no cap"
              aria-label={`Participation limit for ${teacher.email}`}
              className={`neu-inset h-8 w-24 rounded-xl bg-transparent px-2 text-right text-sm text-foreground outline-none focus:ring-1 ${
                quotaInvalid ? "ring-1 ring-destructive/60" : "focus:ring-primary/30"
              }`}
            />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              aria-label={`Renewal for ${teacher.email}`}
              className="neu-inset h-8 rounded-xl bg-transparent px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="none">one-off</option>
              <option value="monthly">monthly</option>
              <option value="days">every N days</option>
            </select>
          </div>

          {mode !== "none" ? (
            <div className="flex items-center gap-2">
              {mode === "days" ? (
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  aria-label={`Cycle length in days for ${teacher.email}`}
                  className={`neu-inset h-8 w-16 rounded-xl bg-transparent px-2 text-right text-xs text-foreground outline-none focus:ring-1 ${
                    daysInvalid ? "ring-1 ring-destructive/60" : "focus:ring-primary/30"
                  }`}
                />
              ) : null}
              <input
                type="date"
                value={anchor}
                max={todayInput()}
                onChange={(e) => setAnchor(e.target.value)}
                title="The date the subscription cycle counts from"
                aria-label={`Cycle start date for ${teacher.email}`}
                className={`neu-inset h-8 rounded-xl bg-transparent px-2 text-xs text-foreground outline-none focus:ring-1 ${
                  anchorInvalid ? "ring-1 ring-destructive/60" : "focus:ring-primary/30"
                }`}
              />
            </div>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="neu-raised h-8 rounded-xl border-0 text-xs shadow-none"
            disabled={busy || !dirty || invalid}
            onClick={() => onSave(parsed, { mode, periodDays: mode === "days" ? daysNum : null, anchor })}
          >
            Save
          </Button>
          {anchorInvalid ? (
            <span className="text-[11px] text-destructive">Pick today or an earlier date.</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export type ResetDraft = {
  mode: CbtTeacherQuotaRow["period"]["mode"];
  periodDays: number | null;
  anchor: string;
};
