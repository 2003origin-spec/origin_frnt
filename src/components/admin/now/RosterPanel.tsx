'use client';

/**
 * Roster (pilot readiness item 3, decision B82): who said they will cover
 * which evening, per subject, for the next 14 evenings — red under two
 * solvers (runbook evening checklist) — and, for today and the last 7
 * evenings, how long each rostered solver was actually online in human hours.
 */

import { dayKeyToDMY } from '@/lib/format-time';

import { useAdminData } from './admin-now-api';
import { ErrorLine, Section, Table, Td, ghostButtonClass } from './ui';

type Solver = { helperId: string; name: string; restricted: boolean; onlineMinutes: number | null };
type Day = {
  day: string;
  weekday: number;
  open: boolean;
  past: boolean;
  subjects: Record<string, { cover: 'none' | 'thin' | 'ok'; solvers: Solver[] }>;
};
type Roster = { openHours: { from: string; to: string }; days: Day[] };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];

const COVER: Record<Day['subjects'][string]['cover'], string> = {
  ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  thin: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  none: 'bg-red-500/15 text-red-800 dark:text-red-300',
};

/** "18:00" → "6:00 pm". */
function clock(hhmm: string | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

function dayLabel(d: Day) {
  return `${WEEKDAYS[d.weekday]} ${dayKeyToDMY(d.day)}`;
}

export function RosterPanel() {
  const { data, error, loading, reload } = useAdminData<Roster>('/roster');
  // `past` includes today (it has minutes online so far), so today is the last past day.
  const today = data?.days.filter((d) => d.past).at(-1)?.day ?? '';
  const ahead = (data?.days ?? []).filter((d) => d.day >= today);
  const behind = (data?.days ?? []).filter((d) => d.past).reverse();

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Roster: today and the next 13 evenings"
        actions={
          <button className={ghostButtonClass} onClick={() => void reload()} disabled={loading}>
            Refresh
          </button>
        }
      >
        <ErrorLine error={error} />
        {data && (
          <p className="mb-2 text-sm text-muted-foreground">
            Solvers tick their evenings on their shift screen. Red: nobody; amber: one solver (the evening checklist wants at least two);
            restricted solvers are struck through and not counted.
          </p>
        )}
        <Table head={['Evening', ...SUBJECTS]} empty={data !== null && ahead.length === 0}>
          {ahead.map((d) => (
            <tr key={d.day}>
              <Td className="whitespace-nowrap">
                {dayLabel(d)}
                {d.day === today && <span className="ml-2 text-xs text-muted-foreground">today</span>}
              </Td>
              {SUBJECTS.map((s) => {
                const cell = d.subjects[s];
                if (!d.open) return <Td key={s} className="text-muted-foreground">closed</Td>;
                return (
                  <Td key={s}>
                    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${COVER[cell.cover]}`}>
                      {cell.solvers.filter((x) => !x.restricted).length} rostered
                    </span>
                    <div className="mt-1 text-xs">
                      {cell.solvers.map((x) => (
                        <span key={x.helperId} className={`mr-2 ${x.restricted ? 'line-through text-muted-foreground' : ''}`}>{x.name}</span>
                      ))}
                    </div>
                  </Td>
                );
              })}
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Did they come online? Today and the last 7 evenings">
        {data && (
          <p className="mb-2 text-sm text-muted-foreground">
            Minutes each rostered solver was online during human hours ({clock(data?.openHours.from)}–{clock(data?.openHours.to)} IST). Today counts so far.
          </p>
        )}
        <Table head={['Evening', ...SUBJECTS]} empty={data !== null && behind.length === 0}>
          {behind.map((d) => (
            <tr key={d.day}>
              <Td className="whitespace-nowrap">{dayLabel(d)}</Td>
              {SUBJECTS.map((s) => (
                <Td key={s} className="text-xs">
                  {!d.open
                    ? 'closed'
                    : d.subjects[s].solvers.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : d.subjects[s].solvers.map((x) => (
                        <div key={x.helperId} className={x.onlineMinutes ? '' : 'font-medium text-red-700 dark:text-red-300'}>
                          {x.name}: {x.onlineMinutes ? `${x.onlineMinutes} min` : 'not online'}
                        </div>
                      ))}
                </Td>
              ))}
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
