'use client';

/**
 * Group sessions for solvers (decision B95): schedule a session on a chapter
 * in one of your subjects (date dd/mm/yyyy, time IST), see seats booked,
 * open the room when it opens, or cancel before it starts (every seat
 * refunded). Hidden while group sessions are switched off.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';

import { DateInputDMY } from '@/components/now/DateInputDMY';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { formatISTDateTimeDMY } from '@/lib/format-time';

import type { Group } from './NowGroups';

const input = 'rounded-md border bg-background px-2 py-1.5 text-sm';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function NowGroupHost({ subjects }: { subjects: string[] }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [form, setForm] = useState({ subject: subjects[0] ?? 'physics', chapter: '', title: '', description: '', day: '', time: '18:00', minutes: 30, seats: 10, priceCoins: 30 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups(((await apiCall('/now/groups/hosted')) as { groups: Group[] }).groups);
    } catch {
      setGroups(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/groups/hosted')
      .then((res) => !cancelled && setGroups((res as { groups: Group[] }).groups))
      .catch(() => !cancelled && setGroups(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // Off, or not a verified solver: nothing to show.
  if (!groups) return null;

  const schedule = async () => {
    setBusy('schedule');
    setError(null);
    try {
      await apiCall('/now/groups', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          chapter: form.chapter,
          title: form.title,
          description: form.description || null,
          // The date and time are IST.
          startsAt: new Date(`${form.day}T${form.time}:00+05:30`).toISOString(),
          minutes: form.minutes,
          seats: form.seats,
          priceCoins: form.priceCoins,
        }),
      });
      setOpen(false);
      setForm({ ...form, chapter: '', title: '', description: '' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (g: Group) => {
    const reason = window.prompt('Tell the students why you are cancelling. Every seat is refunded.');
    if (!reason) return;
    setBusy(g.id);
    setError(null);
    try {
      await apiCall(`/now/groups/${g.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const num = (key: 'minutes' | 'seats' | 'priceCoins', label: string, min: number, max: number) => (
    <label htmlFor={`group-${key}`} className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        id={`group-${key}`}
        type="number"
        min={min}
        max={max}
        className={`${input} w-24`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" aria-hidden /> Group sessions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {groups.length === 0 ? (
          <p className="text-muted-foreground">Take one chapter with a small group: 20 to 45 minutes, up to 15 students, coins per seat.</p>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {g.title}
                  <span className="block text-xs text-muted-foreground">
                    {formatISTDateTimeDMY(g.startsAt)} · {g.minutes} min · {g.seatsTaken}/{g.seats} booked · {g.priceCoins} coins a seat · {g.status}
                    {g.settleOutcome ? ` (${g.settleOutcome})` : ''}
                  </span>
                </span>
                <span className="flex gap-2">
                  {g.canJoin && (
                    <Link href={`/now/groups/room?id=${encodeURIComponent(g.id)}`} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Open the room
                    </Link>
                  )}
                  {g.status === 'scheduled' && (
                    <Button size="sm" variant="ghost" disabled={busy === g.id} onClick={() => cancel(g)}>Cancel</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {open ? (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap gap-2">
              <label htmlFor="group-subject" className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Subject</span>
                <select id="group-subject" className={`${input} capitalize`} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label htmlFor="group-chapter" className="flex flex-1 flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Chapter</span>
                <input id="group-chapter" className={input} maxLength={80} value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="Rotational motion" />
              </label>
            </div>
            <label htmlFor="group-title" className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Title</span>
              <input id="group-title" className={input} maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Torque and angular momentum in 30 minutes" />
            </label>
            <label htmlFor="group-description" className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">What you will cover (optional)</span>
              <textarea id="group-description" className={`${input} min-h-16`} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="group-day" className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Date (dd/mm/yyyy)</span>
                <DateInputDMY id="group-day" value={form.day} onChange={(day) => setForm({ ...form, day })} className={input} />
              </label>
              <label htmlFor="group-time" className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Start (IST)</span>
                <input id="group-time" type="time" className={input} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
              {num('minutes', 'Minutes', 20, 45)}
              {num('seats', 'Seats', 2, 15)}
              {num('priceCoins', 'Coins a seat', 1, 1000)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === 'schedule' || !form.day || !form.title.trim() || !form.chapter.trim()} onClick={schedule}>
                {busy === 'schedule' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Schedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              At least 2 hours ahead, at most 14 days. Join on time: if you are 10 minutes late, every seat is refunded. You are paid per seat
              once the session has run at least half its length.
            </p>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>Schedule a group session</Button>
        )}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
