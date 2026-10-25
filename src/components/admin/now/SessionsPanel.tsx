'use client';

/** Session list and the session review page (plan doc /admin/now/sessions/[id]), with logged recording access. */

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { BoardCanvas } from '@/components/now/NowBoard';
import { isBoardEmpty, type BoardState } from '@/lib/now-board';

import { adminSend, fmtDate, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Row = {
  sessionId: string;
  status: string;
  subject: string;
  difficulty: string;
  solverKind: string;
  solverName: string;
  studentName: string | null;
  acceptedAt: string | null;
  durationSeconds: number | null;
  outcome: string | null;
  payable: boolean | null;
  stars: number | null;
  reports: number;
  hasRecording: boolean;
};

type Review = {
  sessionId: string;
  requestStatus: string;
  subject: string;
  chapter: string | null;
  concept: string | null;
  difficulty: string;
  questionId: string;
  question: { text: string; options: string[]; image?: string | null };
  priceCoins: number;
  solverKind: string;
  solverName: string;
  studentName: string | null;
  studentEmail: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  extensionsUsed: number;
  outcome: string | null;
  rootCause: string | null;
  payable: boolean | null;
  hasRecording: boolean;
  recordingDeletedAt: string | null;
  offers: { id: string; display_name: string; response: string | null; decline_reason: string | null; offered_at: string }[];
  events: { type: string; actor: string | null; at: string; payload: unknown }[];
  ratings: { stars: number; tags: string[]; comment: string | null; tip_coins: number; counted: boolean; held_until_case_closes: boolean }[];
  reports: { id: string; reason: string; status: string; reporter_role: string }[];
  ledger: { kind: string; amount: number; created_at: string }[];
  board: BoardState | null;
};

function SessionReview({ id }: { id: string }) {
  const { data, error } = useAdminData<{ session: Review }>(`/sessions/${id}`);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const s = data?.session;
  if (!s) return <ErrorLine error={error} />;
  const openRecording = async () => {
    setBusy(true);
    try {
      const link = await adminSend<{ url: string }>(`/sessions/${id}/recording`, 'POST', { reason: reason.trim() });
      window.open(link.url, '_blank', 'noopener,noreferrer');
      toast.success('Opened. This access is logged.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Link className="text-sm underline" href="/admin/now?tab=sessions">← All sessions</Link>
      <Section title={`Session ${s.sessionId}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-3">
          <div><dt className="text-muted-foreground">Student</dt><dd>{s.studentName} · {s.studentEmail}</dd></div>
          <div><dt className="text-muted-foreground">Solver</dt><dd>{s.solverKind === 'bot' ? 'Origin bot' : s.solverName}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd>{s.requestStatus} · ended by {s.endedBy ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">Question</dt><dd className="capitalize">{s.subject} · {s.chapter} · {s.difficulty}</dd></div>
          <div><dt className="text-muted-foreground">Times</dt><dd>asked {fmtDate(s.requestedAt)} · started {fmtDate(s.startedAt)} · ended {fmtDate(s.endedAt)}</dd></div>
          <div><dt className="text-muted-foreground">Outcome</dt><dd>{s.outcome ?? '—'} {s.rootCause ? `(${s.rootCause.replace('_', ' ')})` : ''} · payable {String(s.payable)} · {s.extensionsUsed} extensions</dd></div>
        </dl>
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">{s.question.text}</p>
      </Section>
      <Section title="Recording">
        {s.hasRecording ? (
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputClass} min-w-72 flex-1`} placeholder="Why are you opening it? (logged)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className={buttonClass} disabled={busy || reason.trim().length < 5} onClick={openRecording}>Open recording (10 min link)</button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{s.recordingDeletedAt ? `Deleted after retention on ${fmtDate(s.recordingDeletedAt)}.` : 'No recording for this session.'}</p>
        )}
      </Section>
      {s.board && !isBoardEmpty(s.board) && (
        <Section title={`Board (${s.board.pages.length} ${s.board.pages.length === 1 ? 'page' : 'pages'})`}>
          <div className="grid gap-3 md:grid-cols-2">
            {s.board.pages.map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Page {i + 1}</span>
                <BoardCanvas state={{ ...s.board!, page: i }} figureUrl={s.question.image ?? null} />
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Offers">
          <Table head={['Solver', 'Response', 'Reason', 'At']} empty={s.offers.length === 0}>
            {s.offers.map((o) => (
              <tr key={o.id}><Td>{o.display_name}</Td><Td>{o.response ?? 'open'}</Td><Td>{o.decline_reason ?? ''}</Td><Td>{fmtDate(o.offered_at)}</Td></tr>
            ))}
          </Table>
        </Section>
        <Section title="Rating, reports and coins">
          {s.ratings.map((r, i) => (
            <p key={i} className="text-sm">
              {r.stars}★ {r.tags.join(', ')} {r.comment ? `“${r.comment}”` : ''} {r.tip_coins ? `· tip ${r.tip_coins}` : ''}
              {r.held_until_case_closes ? ' · held for a case' : !r.counted ? ' · not counted' : ''}
            </p>
          ))}
          {s.reports.map((r) => (
            <p key={r.id} className="text-sm">Report: {r.reason.replace('_', ' ')} by {r.reporter_role} · {r.status}</p>
          ))}
          <ul className="mt-2 text-xs text-muted-foreground">
            {s.ledger.map((l, i) => <li key={i}>{l.kind} {l.amount} · {fmtDate(l.created_at)}</li>)}
          </ul>
        </Section>
      </div>
      <Section title="Timeline">
        <ul className="text-xs">
          {s.events.map((e, i) => (
            <li key={i} className="flex gap-3 border-b py-1">
              <span className="w-48 shrink-0 whitespace-nowrap text-muted-foreground">{fmtDate(e.at)}</span>
              <span className="font-mono">{e.type}</span>
              <span className="truncate text-muted-foreground">{JSON.stringify(e.payload)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function SessionsPanel({ sessionId }: { sessionId: string | null }) {
  const [kind, setKind] = useState('');
  const { data, error } = useAdminData<{ sessions: Row[] }>(sessionId ? null : `/sessions${kind ? `?kind=${kind}` : ''}`);
  if (sessionId) return <SessionReview id={sessionId} />;
  return (
    <Section
      title="Sessions"
      actions={
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Human and bot</option>
          <option value="human">Human only</option>
          <option value="bot">Bot only</option>
        </select>
      }
    >
      <ErrorLine error={error} />
      <Table head={['When', 'Subject', 'Solver', 'Student', 'Length', 'Outcome', 'Rating', 'Reports', '']} empty={(data?.sessions.length ?? 0) === 0}>
        {(data?.sessions ?? []).map((r) => (
          <tr key={r.sessionId}>
            <Td>{fmtDate(r.acceptedAt)}</Td>
            <Td className="capitalize">{r.subject} · {r.difficulty}</Td>
            <Td>{r.solverKind === 'bot' ? 'Origin bot' : r.solverName}</Td>
            <Td>{r.studentName}</Td>
            <Td>{r.durationSeconds === null ? '—' : `${Math.round(r.durationSeconds / 60)} min`}</Td>
            <Td>{r.outcome ?? r.status}</Td>
            <Td>{r.stars ? `${r.stars}★` : '—'}</Td>
            <Td className={r.reports ? 'font-semibold text-red-700' : ''}>{r.reports}</Td>
            <Td><Link className={ghostButtonClass} href={`/admin/now?tab=sessions&id=${r.sessionId}`}>Review</Link></Td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
