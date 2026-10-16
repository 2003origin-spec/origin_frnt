'use client';

/** Live monitor (plan doc: read-only): waiting, live, online per subject, today's numbers, queues. */

import Link from 'next/link';

import { fmtDate, pct, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Stat, Table, Td } from './ui';

type Monitor = {
  at: string;
  waiting: { requestId: string; subject: string; difficulty: string; status: string; failedOffers: number; waitedSeconds: number }[];
  live: { sessionId: string; subject: string; solverKind: string; solverName: string; startedAt: string | null; endsAt: string | null; joining: boolean }[];
  online: Record<string, { count: number; helpers: { id: string; name: string }[] }>;
  today: {
    requests: number;
    humanSessions: number;
    botSessions: number;
    humanConnectWithin10: number | null;
    botShare: number | null;
    noHelper: number;
    cancelled: number;
    medianHumanWaitSeconds: number | null;
  };
  queues: { open_reports: number; child_safety: number; restricted: number; applications: number };
  recentEvents: { type: string; at: string; requestId: string | null; sessionId: string | null }[];
};

export function OverviewPanel() {
  const { data, error } = useAdminData<Monitor>('/monitor', 15_000);
  if (!data) return <ErrorLine error={error} />;
  const t = data.today;
  return (
    <div className="flex flex-col gap-4">
      <ErrorLine error={error} />
      {data.queues.child_safety > 0 && (
        <Link href="/admin/now?tab=reports" className="rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm font-medium text-red-700">
          {data.queues.child_safety} open child-safety report{data.queues.child_safety > 1 ? 's' : ''}: first response is due within one working day.
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests today" value={t.requests} />
        <Stat label="Human connect ≤ 10 min" value={pct(t.humanConnectWithin10)} hint="Never counts the bot" />
        <Stat label="Bot share of sessions" value={pct(t.botShare)} hint={`${t.botSessions} bot · ${t.humanSessions} human`} />
        <Stat label="Median human wait" value={t.medianHumanWaitSeconds === null ? '—' : `${t.medianHumanWaitSeconds}s`} />
        <Stat label="Closed, no helper" value={t.noHelper} />
        <Stat label="Cancelled" value={t.cancelled} />
        <Stat label="Open reports" value={<Link href="/admin/now?tab=reports">{data.queues.open_reports}</Link>} />
        <Stat label="Applications waiting" value={<Link href="/admin/now?tab=applications">{data.queues.applications}</Link>} hint={`${data.queues.restricted} solvers restricted`} />
      </div>
      <Section title="Solvers online now">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(data.online).map(([subject, o]) => (
            <div key={subject} className="rounded-lg border p-3 text-sm">
              <p className="font-medium capitalize">{subject}</p>
              <p className="text-xl font-semibold">{o.count}</p>
              <p className="text-xs text-muted-foreground">{o.helpers.map((h) => h.name).join(', ') || 'Nobody'}</p>
            </div>
          ))}
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Waiting (${data.waiting.length})`}>
          <Table head={['Subject', 'Difficulty', 'Status', 'Failed offers', 'Waiting']} empty={data.waiting.length === 0}>
            {data.waiting.map((w) => (
              <tr key={w.requestId}>
                <Td className="capitalize">{w.subject}</Td>
                <Td>{w.difficulty}</Td>
                <Td>{w.status}</Td>
                <Td>{w.failedOffers}</Td>
                <Td className={w.waitedSeconds > 180 ? 'font-semibold text-amber-700' : ''}>{Math.floor(w.waitedSeconds / 60)}m {w.waitedSeconds % 60}s</Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title={`Live and joining (${data.live.length})`}>
          <Table head={['Subject', 'Solver', 'State', 'Ends']} empty={data.live.length === 0}>
            {data.live.map((l) => (
              <tr key={l.sessionId}>
                <Td className="capitalize">{l.subject}</Td>
                <Td>{l.solverKind === 'bot' ? 'Origin bot' : l.solverName}</Td>
                <Td>
                  <Link className="underline" href={`/admin/now?tab=sessions&id=${l.sessionId}`}>
                    {l.joining ? 'joining' : 'live'}
                  </Link>
                </Td>
                <Td>{fmtDate(l.endsAt)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
      <Section title="Latest events">
        <ul className="grid gap-1 text-xs md:grid-cols-2">
          {data.recentEvents.map((e, i) => (
            <li key={i} className="flex justify-between gap-2 border-b py-1">
              <span className="font-mono">{e.type}</span>
              <span className="text-muted-foreground">{fmtDate(e.at)}</span>
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-xs text-muted-foreground">Refreshes every 15 seconds. Last update {fmtDate(data.at)}.</p>
    </div>
  );
}
