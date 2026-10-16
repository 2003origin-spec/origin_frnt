'use client';

/** Solver application queue: list, open (10-minute document links), approve with the demo result, reject. */

import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Summary = { id: string; name: string | null; email: string | null; role: string; displayName: string; subjects: string[]; submittedAt: string | null; isMinor: boolean };
type Detail = {
  id: string;
  status: string;
  role: string;
  displayName: string;
  subjects: string[];
  chapters: Record<string, string[]>;
  languages: string[];
  documents: string[];
  documentLinks: Record<string, string>;
  panMasked: string | null;
  quizScores: Record<string, number>;
  agreementVersion: string | null;
  isMinor: boolean;
  hasSolverConsent: boolean;
  readiness: { ready: boolean; missing: string[] };
};

function ApplicationDetail({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, error } = useAdminData<{ application: Detail }>(`/applications/${id}`);
  const [demoPassed, setDemoPassed] = useState(false);
  const [level, setLevel] = useState('verified');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const app = data?.application;
  if (!app) return <ErrorLine error={error} />;

  const act = async (path: string, body: unknown, message: string) => {
    setBusy(true);
    try {
      await adminSend(`/applications/${id}/${path}`, 'POST', body);
      toast.success(message);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={`${app.displayName} — ${app.role.replace('_', ' ')}`} actions={<button className={ghostButtonClass} onClick={onDone}>Close</button>}>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="text-muted-foreground">Subjects</dt><dd className="capitalize">{app.subjects.join(', ')}</dd></div>
        <div><dt className="text-muted-foreground">Languages</dt><dd>{app.languages.join(', ') || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Quiz</dt><dd>{Object.entries(app.quizScores).map(([s, v]) => `${s} ${v}%`).join(', ') || 'Not taken'}</dd></div>
        <div><dt className="text-muted-foreground">PAN</dt><dd>{app.panMasked ?? (app.isMinor ? 'Not needed (minor)' : 'Missing')}</dd></div>
        <div><dt className="text-muted-foreground">Agreement</dt><dd>{app.agreementVersion ?? 'Not accepted'}</dd></div>
        <div><dt className="text-muted-foreground">Minor</dt><dd>{app.isMinor ? `Yes — guardian consent ${app.hasSolverConsent ? 'given' : 'MISSING'}` : 'No'}</dd></div>
      </dl>
      <h3 className="mb-1 mt-3 text-sm font-semibold">Documents (links last 10 minutes)</h3>
      <ul className="text-sm">
        {app.documents.map((d) => (
          <li key={d}>
            {app.documentLinks[d] ? (
              <a className="underline" href={app.documentLinks[d]} target="_blank" rel="noreferrer">{d.replace('_', ' ')}</a>
            ) : (
              <span>{d.replace('_', ' ')} (storage not configured here)</span>
            )}
          </li>
        ))}
      </ul>
      {!app.readiness.ready && <p className="mt-2 text-sm text-amber-700">Still missing: {app.readiness.missing.join(' ')}</p>}
      {app.status === 'submitted' && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={demoPassed} onChange={(e) => setDemoPassed(e.target.checked)} /> Demo doubt passed</label>
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="trainee">Trainee</option>
              <option value="verified">Verified</option>
              <option value="expert">Expert</option>
            </select>
            <button className={buttonClass} disabled={busy || !demoPassed} onClick={() => act('approve', { demoPassed, level }, 'Solver approved.')}>Approve</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputClass} min-w-64 flex-1`} placeholder="Reason for rejecting (the applicant sees it)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className={ghostButtonClass} disabled={busy || reason.trim().length < 5} onClick={() => act('reject', { reason: reason.trim() }, 'Application rejected; documents deleted.')}>Reject</button>
          </div>
        </div>
      )}
    </Section>
  );
}

export function ApplicationsPanel() {
  const [status, setStatus] = useState('submitted');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useAdminData<{ applications: Summary[] }>(`/applications?status=${status}`);
  return (
    <div className="flex flex-col gap-4">
      {open && <ApplicationDetail id={open} onDone={() => { setOpen(null); void reload(); }} />}
      <Section
        title="Solver applications"
        actions={
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="submitted">Waiting for review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Drafts</option>
          </select>
        }
      >
        <ErrorLine error={error} />
        <Table head={['Applicant', 'Role', 'Subjects', 'Minor', 'Submitted', '']} empty={(data?.applications.length ?? 0) === 0}>
          {(data?.applications ?? []).map((a) => (
            <tr key={a.id}>
              <Td>{a.name ?? a.displayName}<div className="text-xs text-muted-foreground">{a.email}</div></Td>
              <Td>{a.role.replace('_', ' ')}</Td>
              <Td className="capitalize">{a.subjects.join(', ')}</Td>
              <Td>{a.isMinor ? 'Yes' : 'No'}</Td>
              <Td>{fmtDate(a.submittedAt)}</Td>
              <Td><button className={ghostButtonClass} onClick={() => setOpen(a.id)}>Open</button></Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
