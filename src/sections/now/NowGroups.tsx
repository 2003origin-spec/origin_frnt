'use client';

/**
 * Group sessions for students (decision B95): upcoming sessions by verified
 * solvers, a seat per student paid in coins (held; cancel until an hour
 * before), Join when the room opens, and a rating afterwards.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Coins, Loader2, Star, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { formatISTDateTimeDMY } from '@/lib/format-time';

export type Group = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  description: string | null;
  startsAt: string;
  minutes: number;
  seats: number;
  seatsTaken: number;
  priceCoins: number;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  solverName: string;
  settleOutcome: 'paid' | 'refunded' | null;
  cancelReason: string | null;
  mySeat: { id: string; status: string; stars: number | null } | null;
  canJoin: boolean;
  canCancelSeat: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function NowGroups() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups(((await apiCall('/now/groups')) as { groups: Group[] }).groups);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/groups')
      .then((res) => !cancelled && setGroups((res as { groups: Group[] }).groups))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const act = async (group: Group, path: 'book' | 'cancel-seat' | 'rate', body?: unknown) => {
    setBusy(group.id);
    setError(null);
    try {
      await apiCall(`/now/groups/${group.id}/${path}`, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
      setConfirming(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!groups) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">Group sessions</h1>
        <p className="text-sm text-muted-foreground">
          A verified solver goes through one chapter with a small group. You listen, raise your hand, and the solver can give you the mic.
          Sessions are audio only and recorded for safety.
        </p>
      </header>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border p-4 text-sm">
          <p className="text-muted-foreground">No group sessions are coming up right now. Solvers add new ones every week.</p>
          <Link href="/ogcode" className="inline-flex min-h-[48px] items-center rounded-full border px-5 font-medium">
            Practise a question meanwhile
          </Link>
        </div>
      ) : (
        groups.map((g) => {
          const full = g.seatsTaken >= g.seats;
          const booked = g.mySeat && g.mySeat.status === 'booked';
          return (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{g.title}</span>
                  <span className="text-xs font-normal text-muted-foreground"><span className="capitalize">{g.subject}</span> · {g.chapter}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {g.description && <p className="text-muted-foreground">{g.description}</p>}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden /> {formatISTDateTimeDMY(g.startsAt)} · {g.minutes} min</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {g.seatsTaken}/{g.seats} seats</span>
                  <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-warning" aria-hidden /> {g.priceCoins} coins</span>
                  <span>with {g.solverName}</span>
                </p>
                {g.status === 'cancelled' && <p className="text-xs text-destructive">Cancelled{g.cancelReason ? `: ${g.cancelReason}` : ''}. Your coins are back.</p>}
                {g.status === 'ended' && g.mySeat && (
                  <p className="text-xs text-muted-foreground">
                    {g.settleOutcome === 'refunded' ? 'It did not run as planned; your coins are back.' : 'Ended.'}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {booked && g.canJoin && (
                    <Link
                      href={`/now/groups/room?id=${encodeURIComponent(g.id)}`}
                      className="inline-flex min-h-[48px] items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
                    >
                      Join now
                    </Link>
                  )}
                  {booked && !g.canJoin && g.status === 'scheduled' && <span className="text-xs text-success">You have a seat. The room opens 10 minutes before.</span>}
                  {g.canCancelSeat && (
                    <Button className="h-[48px]" size="sm" variant="ghost" disabled={busy === g.id} onClick={() => act(g, 'cancel-seat')}>
                      Cancel my seat (coins back)
                    </Button>
                  )}
                  {!g.mySeat && g.status === 'scheduled' && !full &&
                    (confirming === g.id ? (
                      <>
                        <Button className="h-[48px]" size="sm" disabled={busy === g.id} onClick={() => act(g, 'book')}>
                          {busy === g.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Book for {g.priceCoins} coins
                        </Button>
                        <Button className="h-[48px]" size="sm" variant="ghost" onClick={() => setConfirming(null)}>Not now</Button>
                      </>
                    ) : (
                      <Button className="h-[48px]" size="sm" variant="outline" onClick={() => setConfirming(g.id)}>Book a seat</Button>
                    ))}
                  {!g.mySeat && full && g.status === 'scheduled' && <span className="text-xs text-muted-foreground">Full</span>}
                  {g.status === 'ended' && g.mySeat && !g.mySeat.stars && g.mySeat.status !== 'cancelled' && (
                    <span className="flex items-center gap-1 text-xs">
                      Rate it:
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button className="cursor-pointer rounded-full p-[12px]" key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => act(g, 'rate', { stars: n })}>
                          <Star className="h-[24px] w-[24px] text-warning" />
                        </button>
                      ))}
                    </span>
                  )}
                  {g.mySeat?.stars && <span className="text-xs text-muted-foreground">You rated it {g.mySeat.stars}★</span>}
                </div>
                {!g.mySeat && g.status === 'scheduled' && (
                  <p className="text-[11px] text-muted-foreground">Coins are held when you book and come back if you cancel an hour or more before, or if the session does not run.</p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
