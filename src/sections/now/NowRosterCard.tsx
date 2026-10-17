'use client';

/**
 * "My evenings" on the solver screen (pilot readiness item 3, decision B82):
 * the next 14 evenings, one tick per subject. A day locks once its shift has
 * started; closed days cannot be picked. Saved straight away, one tick at a time.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { dayKeyToDMY } from '@/lib/format-time';

type Roster = {
  subjects: string[];
  openHours: { from: string; to: string };
  canEdit: boolean;
  eveningBonus: { coins: number; minOnlinePercent: number; requireRoster: boolean } | null;
  days: { day: string; weekday: number; open: boolean; editable: boolean; subjects: string[] }[];
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "18:00" → "6:00 pm". */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function NowRosterCard() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/solver/roster')
      .then((res) => !cancelled && setRoster(res.roster as Roster))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load your evenings.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (day: string, subject: string, on: boolean) => {
    const key = `${day}|${subject}`;
    setSaving(key);
    setError(null);
    try {
      const res = await apiCall('/now/solver/roster', { method: 'PUT', body: JSON.stringify({ day, subject, on }) });
      setRoster(res.roster as Roster);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" aria-hidden /> My evenings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!roster ? (
          error ? <p className="text-red-600" role="alert">{error}</p> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />
        ) : (
          <>
            <p className="text-muted-foreground">
              Tick the evenings you will be online ({clock(roster.openHours.from)}–{clock(roster.openHours.to)} IST). The team plans cover
              from this, so untick if your plans change. A day locks once its shift starts.
            </p>
            {roster.eveningBonus && (
              <p className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
                Pilot evening bonus: {roster.eveningBonus.coins} coins for each evening you are online for at least{' '}
                {roster.eveningBonus.minOnlinePercent}% of the shift{roster.eveningBonus.requireRoster ? ' (ticked evenings only)' : ''}. Paid
                overnight.
              </p>
            )}
            {!roster.canEdit && <p className="text-amber-700">Your solver account is on hold, so you cannot change your evenings.</p>}
            {error && <p className="text-red-600" role="alert">{error}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Evening</th>
                    {roster.subjects.map((s) => (
                      <th key={s} className="px-2 py-1 font-medium capitalize">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.days.map((d) => (
                    <tr key={d.day} className={`border-b ${d.open ? '' : 'text-muted-foreground'}`}>
                      <td className="whitespace-nowrap py-1 pr-3">
                        {WEEKDAYS[d.weekday]} {dayKeyToDMY(d.day)}
                        {!d.open && <span className="ml-2 text-xs">closed</span>}
                      </td>
                      {roster.subjects.map((s) => {
                        const key = `${d.day}|${s}`;
                        return (
                          <td key={s} className="px-2 py-1">
                            {d.open && (
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  aria-label={`${s} on ${dayKeyToDMY(d.day)}`}
                                  checked={d.subjects.includes(s)}
                                  disabled={!d.editable || saving !== null}
                                  onChange={(e) => void toggle(d.day, s, e.target.checked)}
                                />
                                {saving === key && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                              </label>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
