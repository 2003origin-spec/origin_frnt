'use client';

/**
 * Student doubts dashboard (build step 10; plan doc "Student dashboard"):
 * summary, by subject, weak spots, my solvers (favourites pinned), history,
 * practice follow-up. Only the student's own data.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';

type Dashboard = {
  summary: { asked: number; resolved: number; partial: number; unresolved: number; minutes: number; coinsSpentThisMonth: number; balance: number };
  bySubject: { subject: string; chapter: string | null; doubts: number; resolvedShare: number | null }[];
  weakSpots: { subject: string; chapter: string | null; concept: string | null; doubts: number; commonRootCause: string | null }[];
  mySolvers: { helperId: string; name: string; subjects: string[]; sessionsTogether: number; myAverageStars: number | null; favourite: boolean; online: boolean }[];
  history: {
    requestId: string;
    questionId: string;
    question: string;
    subject: string;
    difficulty: string;
    status: string;
    createdAt: string | null;
    solverName: string | null;
    minutes: number | null;
    coinsSpent: number;
    outcome: string | null;
    stars: number | null;
  }[];
  hasMoreHistory: boolean;
  practice: { sessionId: string; questionIds: string[]; attempted: number; offeredAt: string | null }[];
};

const ROOT_CAUSE: Record<string, string> = {
  conceptual_gap: 'mostly a concept gap',
  calculation_error: 'mostly calculation slips',
  misread: 'mostly misreading the question',
  careless_error: 'mostly careless mistakes',
  time_pressure: 'mostly time pressure',
  other: 'mixed reasons',
};

const STATUS: Record<string, string> = {
  rated: 'Done',
  unrated: 'Done',
  ended: 'Done',
  cancelled: 'Cancelled',
  no_helper: 'No solver free',
  no_show: 'Nobody joined',
  requested: 'Waiting',
  offered: 'Waiting',
  accepted: 'Connecting',
  live: 'Live now',
};

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function NowDoubtsDashboard() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiCall(`/now/me/dashboard?page=${page}`);
      setData(res.dashboard as Dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your doubts.');
    }
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    apiCall(`/now/me/dashboard?page=${page}`)
      .then((res) => !cancelled && setData(res.dashboard as Dashboard))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load your doubts.'));
    return () => {
      cancelled = true;
    };
  }, [page]);

  const toggleFavourite = async (helperId: string, favourite: boolean) => {
    try {
      await apiCall(`/now/favourites/${helperId}`, { method: favourite ? 'DELETE' : 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update favourites.');
    }
  };

  if (!data) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  const s = data.summary;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">My doubts</h1>
        <p className="text-sm text-muted-foreground">Your live help sessions, what they covered and what to practise next.</p>
      </header>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Doubts asked" value={s.asked} />
        <Stat label="Solved" value={s.resolved} />
        <Stat label="Partly / not solved" value={`${s.partial} / ${s.unresolved}`} />
        <Stat label="Minutes with solvers" value={s.minutes} />
        <Stat label="Coins spent this month" value={s.coinsSpentThisMonth} />
        <Stat label="Coins left" value={s.balance} />
      </div>

      {data.weakSpots.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Weak spots</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.weakSpots.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  <strong className="capitalize">{w.concept ?? w.chapter ?? w.subject}</strong>
                  <span className="text-muted-foreground"> · {w.doubts} doubt{w.doubts > 1 ? 's' : ''}{w.commonRootCause ? `, ${ROOT_CAUSE[w.commonRootCause] ?? w.commonRootCause}` : ''}</span>
                </span>
                <Link href="/ogcode" className="rounded-md border px-3 py-1 hover:bg-muted">Practise</Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">My solvers</CardTitle></CardHeader>
        <CardContent>
          {data.mySolvers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Solvers you have worked with show up here. Favourites are asked first when they are online.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.mySolvers.map((m) => (
                <li key={m.helperId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      <span className={`h-2 w-2 rounded-full ${m.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} aria-label={m.online ? 'online' : 'offline'} />
                      {m.name}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {m.subjects.join(', ')} · {m.sessionsTogether} session{m.sessionsTogether === 1 ? '' : 's'}
                      {m.myAverageStars ? ` · you rated ${m.myAverageStars.toFixed(1)}★` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-pressed={m.favourite}
                    aria-label={m.favourite ? `Remove ${m.name} from favourites` : `Add ${m.name} to favourites`}
                    onClick={() => toggleFavourite(m.helperId, m.favourite)}
                    className="rounded p-1 hover:bg-muted"
                  >
                    <Heart className={`h-5 w-5 ${m.favourite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.bySubject.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By subject</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Subject · chapter</th><th>Doubts</th><th>Solved</th></tr></thead>
              <tbody>
                {data.bySubject.map((b, i) => (
                  <tr key={i} className="border-t"><td className="py-1 capitalize">{b.subject} · {b.chapter ?? '—'}</td><td>{b.doubts}</td><td>{pct(b.resolvedShare)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {data.practice.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Practice after your sessions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.practice.map((p) => (
              <div key={p.sessionId} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{p.attempted} of {p.questionIds.length} tried:</span>
                {p.questionIds.map((q, i) => (
                  <Link key={q} href={`/ogcode/${encodeURIComponent(q)}`} className="rounded-md border px-2 py-0.5 hover:bg-muted">Question {i + 1}</Link>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doubts yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.history.map((h) => (
                <li key={h.requestId} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1">{h.question || 'Question'}</span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {h.subject} · {h.difficulty} · {h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-IN') : ''}
                      {h.solverName ? ` · ${h.solverName}` : ''}
                      {h.minutes ? ` · ${h.minutes} min` : ''} · {h.coinsSpent} coins
                      {h.outcome ? ` · ${h.outcome}` : ''}{h.stars ? ` · ${h.stars}★` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{STATUS[h.status] ?? h.status}</span>
                    {['requested', 'offered', 'accepted', 'live'].includes(h.status) ? (
                      <Link href={`/now/room?request=${h.requestId}`} className="rounded-md border px-2 py-0.5 hover:bg-muted">Open</Link>
                    ) : (
                      <Link href={`/ogcode/${encodeURIComponent(h.questionId)}`} className="rounded-md border px-2 py-0.5 hover:bg-muted">Retry question</Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            {page > 0 && <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setPage(page - 1)}>Newer</button>}
            {data.hasMoreHistory && <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setPage(page + 1)}>Older</button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
