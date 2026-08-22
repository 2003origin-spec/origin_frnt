'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { useAuth } from '@/context/AuthContext';

/**
 * Contest global leaderboard (plan Phase 6 UI) — keyset-paged from
 * GET /api/contest/leaderboard. Gated server-side on result_published.
 */

interface Row {
  rank: number;
  userId: string;
  score: number;
  percentile: number;
}

export function ContestLeaderboard({ contestId }: { contestId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [status, setStatus] = useState<'loading' | 'ok' | 'pending' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (from: number) => {
      const res = await fetch(
        `/api/contest/leaderboard?contestId=${encodeURIComponent(contestId)}&cursor=${from}&limit=50`,
        { credentials: 'include' },
      );
      if (res.status === 403) {
        setStatus('pending');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const body = (await res.json()) as { rows: Row[]; nextCursor: number | null };
      setRows((prev) => (from === 0 ? body.rows : [...prev, ...body.rows]));
      setCursor(body.nextCursor);
      setStatus('ok');
    },
    [contestId],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  if (status === 'loading') return <Centered>Loading leaderboard…</Centered>;
  if (status === 'error') return <Centered>Couldn't load the leaderboard.</Centered>;
  if (status === 'pending')
    return (
      <Centered>
        <Trophy className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-muted-foreground text-center max-w-sm">
          The leaderboard publishes once the contest ends. Check back soon.
        </p>
      </Centered>
    );

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="p-2 rounded-xl neu-raised text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
          </h1>
        </div>

        <div className="neu-raised rounded-2xl divide-y divide-border/20">
          {rows.map((r) => {
            const isMe = user?.id != null && r.userId === user.id;
            return (
            <div
              key={r.userId}
              className={cn('flex items-center justify-between px-4 py-3', isMe && 'bg-primary/10')}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'w-8 text-center text-sm font-black tabular-nums',
                    r.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground',
                  )}
                >
                  {r.rank}
                </span>
                <span className={cn('text-[13px] font-bold', isMe ? 'text-primary' : 'text-foreground')}>
                  {isMe ? 'You' : `Player ${r.userId.slice(-4)}`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-bold text-muted-foreground">{r.percentile}%ile</span>
                <span className="text-sm font-black text-primary tabular-nums">{r.score}</span>
              </div>
            </div>
            );
          })}
        </div>

        {cursor !== null && (
          <NeuButton
            onClick={async () => {
              setLoadingMore(true);
              await loadPage(cursor);
              setLoadingMore(false);
            }}
            disabled={loadingMore}
            className="w-full"
          >
            <span className="font-black text-[12px] uppercase tracking-wider">
              {loadingMore ? 'Loading…' : 'Load more'}
            </span>
          </NeuButton>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6 text-foreground">
      {children}
    </div>
  );
}
