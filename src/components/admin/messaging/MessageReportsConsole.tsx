'use client';

/**
 * /admin/moderation/messages — reports students made about messages.
 * Lists reports, shows the whole conversation (from the reporter's side) and
 * resolves a report: dismiss, warn (the reported student gets a notification)
 * or suspend messaging for 1–90 days. Every action is in the audit log.
 * Data: /api/admin/messaging/* (admin role checked there).
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';
import { formatISTDateTimeDMY, formatISTDayDMY } from '@/lib/format-time';

import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from '../now/ui';

const API = '/api/admin/messaging';
const PAGE_SIZE = 20;

type Person = { id: string; username: string | null; name: string; avatar: string | null };
type Report = {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  status: 'open' | 'resolved';
  reporter: Person;
  reported: Person;
  conversationId: string;
  resolvedAt: string | null;
  resolution: 'dismiss' | 'warn' | 'suspend' | null;
  resolutionNote: string | null;
};
type Message = { id: string; text: string; fromMe: boolean; at: string; units: number };

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail ?? `Request failed (${res.status})`;
}

function useAdminGet<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const res = await fetch(`${API}${path}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res));
      setData((await res.json()) as T);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}

const who = (p: Person) => (p.username ? `${p.name} (@${p.username})` : p.name);
const fmt = (iso: string | null) => (iso ? formatISTDateTimeDMY(iso) : '—');

const RESOLUTION_LABEL: Record<NonNullable<Report['resolution']>, string> = {
  dismiss: 'Dismissed',
  warn: 'Warned',
  suspend: 'Suspended',
};

function ReportDetail({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, error } = useAdminGet<{ report: Report; messages: Message[]; suspendedUntil: string | null }>(`/reports/${id}`);
  const [note, setNote] = useState('');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  if (!data) return <ErrorLine error={error} />;
  const r = data.report;

  const resolve = async (action: 'dismiss' | 'warn' | 'suspend') => {
    setBusy(true);
    try {
      const res = await mutateJson(`${API}/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action, note: note.trim() || undefined, ...(action === 'suspend' ? { days: Number(days) } : {}) }),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.success(`Report ${RESOLUTION_LABEL[action].toLowerCase()}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  const daysValid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 90;

  return (
    <Section title={`Report: ${r.reason}`} actions={<button className={ghostButtonClass} onClick={onDone}>Close</button>}>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="text-muted-foreground">Reported by</dt><dd>{who(r.reporter)}</dd></div>
        <div>
          <dt className="text-muted-foreground">Reported student</dt>
          <dd>
            {who(r.reported)}
            {data.suspendedUntil && (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                paused until {formatISTDayDMY(data.suspendedUntil)}
              </span>
            )}
          </dd>
        </div>
        <div><dt className="text-muted-foreground">When</dt><dd>{fmt(r.createdAt)}</dd></div>
        <div><dt className="text-muted-foreground">Note from the reporter</dt><dd>{r.note ?? '—'}</dd></div>
      </dl>

      <h3 className="mt-4 text-sm font-semibold">Conversation ({data.messages.length} messages)</h3>
      <div className="mt-2 flex max-h-[420px] flex-col gap-1.5 overflow-y-auto rounded-lg border p-3">
        {data.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.fromMe ? 'items-start' : 'items-end'}`}>
            <span className="text-[11px] text-muted-foreground">
              {m.fromMe ? r.reporter.name : r.reported.name} · {fmt(m.at)}
            </span>
            <p
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
                m.fromMe ? 'bg-muted' : 'border border-red-500/30 bg-red-500/10'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
      </div>

      {r.status === 'open' ? (
        <div className="mt-4 flex flex-col gap-2 border-t pt-3">
          <textarea
            className={inputClass}
            rows={2}
            maxLength={1000}
            placeholder="Your note (optional, kept with the report and the audit log; not shown to students)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className={ghostButtonClass} disabled={busy} onClick={() => resolve('dismiss')}>Dismiss</button>
            <button className={ghostButtonClass} disabled={busy} onClick={() => resolve('warn')}>Warn</button>
            <span className="ml-2 flex items-center gap-1 text-sm">
              <input
                className={`${inputClass} w-16`}
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                aria-label="Days to suspend"
              />
              days
            </span>
            <button className={buttonClass} disabled={busy || !daysValid} onClick={() => resolve('suspend')}>Suspend messaging</button>
          </div>
          <p className="text-xs text-muted-foreground">
            Warn and Suspend send the reported student an in-app notification. A suspended student can still read messages but
            can&apos;t start or send any until the date shown to them.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm">
          <strong>{r.resolution ? RESOLUTION_LABEL[r.resolution] : 'Resolved'}</strong> on {fmt(r.resolvedAt)}
          {r.resolutionNote ? `: ${r.resolutionNote}` : ''}
        </p>
      )}
    </Section>
  );
}

export function MessageReportsConsole() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useAdminGet<{ reports: Report[]; total: number }>(`/reports?status=${status}&page=${page}`);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      {open && (
        <ReportDetail
          id={open}
          onDone={() => {
            setOpen(null);
            void reload();
          }}
        />
      )}
      <Section
        title={`Message reports${data ? ` (${data.total})` : ''}`}
        actions={
          <select
            className={inputClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
              setOpen(null);
            }}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        }
      >
        <ErrorLine error={error} />
        <Table
          head={status === 'open' ? ['Reason', 'Reported student', 'Reported by', 'Opened', ''] : ['Reason', 'Reported student', 'Outcome', 'Resolved', '']}
          empty={(data?.reports.length ?? 0) === 0}
        >
          {(data?.reports ?? []).map((r) => (
            <tr key={r.id} className={open === r.id ? 'bg-muted/50' : ''}>
              <Td>{r.reason}</Td>
              <Td>{who(r.reported)}</Td>
              <Td>{status === 'open' ? who(r.reporter) : r.resolution ? RESOLUTION_LABEL[r.resolution] : '—'}</Td>
              <Td>{fmt(status === 'open' ? r.createdAt : r.resolvedAt)}</Td>
              <Td>
                <button className={ghostButtonClass} onClick={() => setOpen(r.id)}>Open</button>
              </Td>
            </tr>
          ))}
        </Table>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button className={ghostButtonClass} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>
              Page {page} of {pages}
            </span>
            <button className={ghostButtonClass} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </Section>
    </div>
  );
}
