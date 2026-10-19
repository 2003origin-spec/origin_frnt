'use client';

/**
 * Pilot scorecard (pilot readiness item 1): the plan doc's pass-or-fail table
 * for a chosen period. The pilot is judged only once 300+ sessions over 10+
 * evenings are in (decision B79).
 */

import { useState } from 'react';

import { DateInputDMY } from '@/components/now/DateInputDMY';
import { formatISTDayDMY } from '@/lib/format-time';

import { useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, buttonClass, ghostButtonClass, inputClass } from './ui';

type Row = { key: string; label: string; value: string; passLine: string; status: 'pass' | 'fail' | 'no_data' | 'info'; note?: string };
type Scorecard = {
  rows: Row[];
  sample: { liveSessions: number; evenings: number; ready: boolean };
  passed: boolean;
  from: string;
  to: string;
};

const STATUS: Record<Row['status'], { label: string; className: string }> = {
  pass: { label: 'Pass', className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  fail: { label: 'Fail', className: 'bg-red-500/15 text-red-800 dark:text-red-300' },
  no_data: { label: 'No data', className: 'bg-muted text-muted-foreground' },
  info: { label: 'Input', className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300' },
};


export function ScorecardPanel() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const path = range ? `/scorecard?from=${range.from}&to=${range.to}` : '/scorecard';
  const { data, error, loading, reload } = useAdminData<Scorecard>(path);

  // The period actually shown: the inclusive end is the day before `to`.
  const shownFrom = data ? formatISTDayDMY(data.from) : '';
  const shownTo = data ? formatISTDayDMY(new Date(data.to).getTime() - 1) : '';

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Pilot scorecard"
        actions={
          <button className={ghostButtonClass} onClick={() => void reload()} disabled={loading}>
            Refresh
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            From (IST)
            <DateInputDMY ariaLabel="From (IST)" className={`${inputClass} w-32`} value={from} onChange={setFrom} />
          </label>
          <label className="flex flex-col gap-1">
            To (IST, inclusive)
            <DateInputDMY ariaLabel="To (IST, inclusive)" className={`${inputClass} w-32`} value={to} onChange={setTo} />
          </label>
          <button className={buttonClass} disabled={!from || !to} onClick={() => setRange({ from, to })}>
            Show period
          </button>
          {range && (
            <button
              className={ghostButtonClass}
              onClick={() => {
                setRange(null);
                setFrom('');
                setTo('');
              }}
            >
              Whole pilot
            </button>
          )}
        </div>
        <ErrorLine error={error} />
        {data && !error && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {shownFrom} to {shownTo} · {data.sample.liveSessions} live {data.sample.liveSessions === 1 ? 'session' : 'sessions'} over{' '}
              {data.sample.evenings} {data.sample.evenings === 1 ? 'evening' : 'evenings'} with a human call.
            </p>
            <div
              className={`mb-3 rounded-md border p-3 text-sm font-medium ${
                !data.sample.ready
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                  : data.passed
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                    : 'border-red-500/60 bg-red-500/10 text-red-900 dark:text-red-200'
              }`}
            >
              {!data.sample.ready
                ? 'Too early to judge: the pilot is judged after at least 300 sessions over at least 10 evenings.'
                : data.passed
                  ? 'Every row passes. The pilot meets its pass lines for this period.'
                  : 'At least one row fails. The pilot does not meet its pass lines for this period.'}
            </div>
            <Table head={['Measure', 'This period', 'Pass line', 'Result']}>
              {data.rows.map((r) => (
                <tr key={r.key}>
                  <Td>
                    <p>{r.label}</p>
                    {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  </Td>
                  <Td className="tabular-nums">{r.value}</Td>
                  <Td>{r.passLine}</Td>
                  <Td>
                    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                  </Td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Section>
    </div>
  );
}
