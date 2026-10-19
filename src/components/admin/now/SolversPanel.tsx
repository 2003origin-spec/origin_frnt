'use client';

/** Solver metrics (cherry-picking check, concentration report) and restricted solvers. */

import { useState } from 'react';
import { toast } from 'sonner';

import { adminSend, fmtDate, pct, useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, ghostButtonClass, inputClass } from './ui';

type Metrics = {
  monthStart: string;
  concentrationLimit: number;
  solvers: {
    helperId: string;
    name: string;
    status: string;
    offers: number;
    acceptRate: number | null;
    acceptRateByDifficulty: Record<string, number | null>;
    tooHardShareOfDeclines: number | null;
    lowAcceptRate: boolean;
    sessions: number;
    resolutionRate: number | null;
    avgStars: number | null;
    monthCoins: number;
    monthStudents: number;
    topThreeShare: number;
    concentrationFlag: boolean;
  }[];
  fallbackByDifficulty: Record<string, { sessions: number; botShare: number | null }>;
};
type Restricted = { id: string; display_name: string; restricted_reason: string | null; updated_at: string; open_reports: number };

function RestrictedList() {
  const { data, error, reload } = useAdminData<{ helpers: Restricted[] }>('/helpers/restricted');
  const [note, setNote] = useState('');
  const reinstate = async (id: string) => {
    try {
      await adminSend(`/helpers/${id}/reinstate`, 'POST', { note: note.trim() });
      toast.success('Solver reinstated.');
      setNote('');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed.');
    }
  };
  return (
    <Section title="Restricted solvers">
      <ErrorLine error={error} />
      <input className={`${inputClass} mb-2 w-full`} placeholder="Note for reinstating (what you checked)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Table head={['Solver', 'Why', 'Since', 'Open reports', '']} empty={(data?.helpers.length ?? 0) === 0}>
        {(data?.helpers ?? []).map((h) => (
          <tr key={h.id}>
            <Td>{h.display_name}</Td>
            <Td>{h.restricted_reason}</Td>
            <Td>{fmtDate(h.updated_at)}</Td>
            <Td>{h.open_reports}</Td>
            <Td>
              <button className={ghostButtonClass} disabled={note.trim().length < 5 || h.open_reports > 0} onClick={() => reinstate(h.id)} title={h.open_reports ? 'Close the open reports first' : ''}>
                Reinstate
              </button>
            </Td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

export function SolversPanel() {
  const { data, error } = useAdminData<Metrics>('/metrics');
  return (
    <div className="flex flex-col gap-4">
      <RestrictedList />
      <Section title="Solvers this pilot">
        <ErrorLine error={error} />
        <Table head={['Solver', 'Offers', 'Accept', 'E / M / H / I accept', 'Too-hard declines', 'Sessions', 'Resolved', 'Rating', 'Coins this month', 'Top-3 share']} empty={(data?.solvers.length ?? 0) === 0}>
          {(data?.solvers ?? []).map((s) => (
            <tr key={s.helperId}>
              <Td>{s.name}<div className="text-xs text-muted-foreground">{s.status}</div></Td>
              <Td>{s.offers}</Td>
              <Td className={s.lowAcceptRate ? 'font-semibold text-amber-700' : ''}>{pct(s.acceptRate)}{s.lowAcceptRate ? ' · talk to them' : ''}</Td>
              <Td>{['easy', 'medium', 'hard', 'insane'].map((d) => pct(s.acceptRateByDifficulty[d])).join(' / ')}</Td>
              <Td>{pct(s.tooHardShareOfDeclines)}</Td>
              <Td>{s.sessions}</Td>
              <Td>{pct(s.resolutionRate)}</Td>
              <Td>{s.avgStars === null ? '—' : s.avgStars.toFixed(1)}</Td>
              <Td>{s.monthCoins} from {s.monthStudents}</Td>
              <Td className={s.concentrationFlag ? 'font-semibold text-red-700' : ''}>{s.monthCoins ? pct(s.topThreeShare) : '—'}{s.concentrationFlag ? ' · review' : ''}</Td>
            </tr>
          ))}
        </Table>
        {data && (
          <p className="mt-2 text-xs text-muted-foreground">
            Concentration: over {pct(data.concentrationLimit)} of a solver&apos;s coins this month from their top three students is listed for review (farming check). Below 50% accept rate after 20 offers is flagged for a conversation, not a restriction.
          </p>
        )}
      </Section>
      {data && (
        <Section title="Bot fallback by difficulty">
          <p className="mb-2 text-xs text-muted-foreground">If Hard and Insane fall back to the bot at twice the rate of Easy, raise the human price for those difficulties (a pay problem, not a matching problem).</p>
          <Table head={['Difficulty', 'Sessions', 'Bot share']}>
            {Object.entries(data.fallbackByDifficulty).map(([d, f]) => (
              <tr key={d}><Td className="capitalize">{d}</Td><Td>{f.sessions}</Td><Td>{pct(f.botShare)}</Td></tr>
            ))}
          </Table>
        </Section>
      )}
    </div>
  );
}
