'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { useAuth } from '@/context/AuthContext';

/**
 * Global all-time ORBIT leaderboard — every non-provisional contestant ranked by
 * rating. Keyset-paged from GET /api/contest/orbit-leaderboard. Highlights "You".
 */

interface Row {
  rank: number;
  userId: string;
  displayName: string;
  rating: number;
  tier: string;
}

export function OrbitLeaderboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (from: number) => {
    const res = await fetch(`/api/contest/orbit-leaderboard?cursor=${from}`, { credentials: 'include' });
    if (!res.ok) { setStatus('error'); return; }
    const body = (await res.json()) as { rows: Row[]; nextCursor: number | null };
    setRows((prev) => (from === 0 ? body.rows : [...prev, ...body.rows]));
    setCursor(body.nextCursor);
    setStatus('ok');
  }, []);

  useEffect(() => { void loadPage(0); }, [loadPage]);

  if (status === 'loading') return <Centered><Loader2 className="w-8 h-8 animate-spin text-primary" /></Centered>;
  if (status === 'error') return <Centered>Couldn&apos;t load the ORBIT rankings.</Centered>;

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> ORBIT Rankings
          </h1>
        </div>

        {rows.length === 0 ? (
          <div className="neu-raised rounded-2xl p-8 text-center text-muted-foreground text-sm">
            No rated players yet — rankings appear once contestants complete a few contests.
          </div>
        ) : (
          <div className="neu-raised rounded-2xl divide-y divide-border/20">
            {rows.map((r) => {
              const isMe = user?.id != null && r.userId === user.id;
              return (
                <div key={r.userId} className={cn('flex items-center justify-between px-4 py-3', isMe && 'bg-primary/10')}>
                  <div className="flex items-center gap-3">
                    <span className={cn('w-8 text-center text-sm font-black tabular-nums', r.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground')}>{r.rank}</span>
                    <div>
                      <div className={cn('text-[13px] font-bold', isMe ? 'text-primary' : 'text-foreground')}>
                        {isMe ? 'You' : `${r.displayName} ${r.userId.slice(-4)}`}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{r.tier}</div>
                    </div>
                  </div>
                  <span className="text-base font-black text-primary tabular-nums">{r.rating}</span>
                </div>
              );
            })}
          </div>
        )}

        {cursor !== null && rows.length > 0 && (
          <NeuButton onClick={async () => { setLoadingMore(true); await loadPage(cursor); setLoadingMore(false); }} disabled={loadingMore} className="w-full">
            <span className="font-black text-[12px] uppercase tracking-wider">{loadingMore ? 'Loading…' : 'Load more'}</span>
          </NeuButton>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6 text-foreground">{children}</div>;
}
