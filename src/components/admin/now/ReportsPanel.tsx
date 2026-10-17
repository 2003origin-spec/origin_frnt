'use client';

/**
 * Reports queue (plan doc: owned by the Grievance Officer; child-safety first,
 * first response within one working day; POCSO: police the same day).
 */

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, LegalNote, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Case = {
  id: string;
  status: string;
  reason: string;
  details: string | null;
  reporterRole: string | null;
  sessionId: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolutionNote: string | null;
  hasRecording: boolean;
};

function CaseDetail({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, error } = useAdminData<{ report: Case; events: { type: string; at: string; actor: string | null }[] }>(`/reports/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return <ErrorLine error={error} />;
  const r = data.report;
  const resolve = async (outcome: 'upheld' | 'dismissed') => {
    setBusy(true);
    try {
      await adminSend(`/reports/${id}/resolve`, 'POST', { outcome, note: note.trim() });
      toast.success(`Report ${outcome}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={`Report: ${r.reason.replace('_', ' ')}`} actions={<button className={ghostButtonClass} onClick={onDone}>Close</button>}>
      {r.reason === 'child_safety' && (
        <p className="mb-3 rounded-md border border-red-500 bg-red-500/10 p-2 text-sm text-red-700">
          Child safety. If it points to a sexual offence against a child, POCSO section 19 requires a police report the same day — do that before any internal inquiry.
        </p>
      )}
      {(r.reason === 'child_safety' || r.reason === 'abuse') && (
        <div className="mb-3">
          <LegalNote>follow the written reporting procedure the legal team approved, and tell the Grievance Officer before you resolve this case.</LegalNote>
        </div>
      )}
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="text-muted-foreground">Reported by</dt><dd>{r.reporterRole === 'solver' ? 'the solver (about the student)' : 'the student (about the solver)'}</dd></div>
        <div><dt className="text-muted-foreground">When</dt><dd>{fmtDate(r.createdAt)} · first response {fmtDate(r.firstResponseAt)}</dd></div>
        <div className="md:col-span-2"><dt className="text-muted-foreground">Details</dt><dd>{r.details ?? '—'}</dd></div>
      </dl>
      {r.sessionId && (
        <p className="mt-2 text-sm">
          <Link className="underline" href={`/admin/now?tab=sessions&id=${r.sessionId}`}>Open the session review{r.hasRecording ? ' (recording available)' : ''}</Link>
        </p>
      )}
      {r.status === 'open' ? (
        <div className="mt-4 flex flex-col gap-2 border-t pt-3">
          <textarea className={inputClass} rows={3} placeholder="What you found and why (kept with the case)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className={buttonClass} disabled={busy || note.trim().length < 5} onClick={() => resolve('upheld')}>Uphold (strike)</button>
            <button className={ghostButtonClass} disabled={busy || note.trim().length < 5} onClick={() => resolve('dismissed')}>Dismiss</button>
          </div>
          <p className="text-xs text-muted-foreground">
            Upheld against a solver: restricted at once, coins stay frozen until reinstated. Against a student: one upheld abuse or child-safety report pauses live help until reviewed; two upheld reports pause it for 30 days, and the guardian is emailed.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm">Closed as <strong>{r.status}</strong>: {r.resolutionNote}</p>
      )}
    </Section>
  );
}

export function ReportsPanel() {
  const [status, setStatus] = useState<'open' | 'upheld' | 'dismissed'>('open');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useAdminData<{ reports: Case[] }>(`/reports?status=${status}`);
  return (
    <div className="flex flex-col gap-4">
      {open && <CaseDetail id={open} onDone={() => { setOpen(null); void reload(); }} />}
      <Section
        title="Reports"
        actions={
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="open">Open</option>
            <option value="upheld">Upheld</option>
            <option value="dismissed">Dismissed</option>
          </select>
        }
      >
        <ErrorLine error={error} />
        <Table head={['Reason', 'From', 'Opened', 'First response', '']} empty={(data?.reports.length ?? 0) === 0}>
          {(data?.reports ?? []).map((r) => (
            <tr key={r.id} className={r.reason === 'child_safety' ? 'bg-red-500/5' : ''}>
              <Td className={r.reason === 'child_safety' ? 'font-semibold text-red-700' : ''}>{r.reason.replace('_', ' ')}</Td>
              <Td>{r.reporterRole ?? '—'}</Td>
              <Td>{fmtDate(r.createdAt)}</Td>
              <Td>{fmtDate(r.firstResponseAt)}</Td>
              <Td><button className={ghostButtonClass} onClick={() => setOpen(r.id)}>Open</button></Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
