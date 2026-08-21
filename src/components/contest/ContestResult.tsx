'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, TrendingUp, TrendingDown, Trophy, Medal, Target } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { useAuth } from '@/context/AuthContext';
import ShareableReportCard from '@/components/results/ShareableReportCard';
import ContestShareCard from '@/components/contest/ContestShareCard';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { track } from '@/lib/analytics';

/**
 * Contest result screen (plan Phase 6 UI) — subject-wise performance +
 * PROMINENT ORBIT movement + rank/percentile, with the shareable result card
 * (growth loop). Gated server-side on result_published (403 → "not published").
 */

interface SectionScore {
  score: number;
  correct: number;
  total: number;
}

interface ResultData {
  contestName: string;
  personal: { rank: number; percentile: number; score: number; totalRanked: number } | null;
  orbit: { rating: number; tier: string; provisional: boolean } | null;
  orbitMovement: { before: number; after: number; change: number } | null;
  attempt: {
    score: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    timeTakenSeconds: number | null;
    sectionScores: Record<string, SectionScore> | null;
  } | null;
}

export function ContestResult({ contestId }: { contestId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ResultData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'pending' | 'error'>('loading');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contest/result?contestId=${encodeURIComponent(contestId)}`, {
          credentials: 'include',
        });
        if (res.status === 403) {
          if (!cancelled) setStatus('pending');
          return;
        }
        if (!res.ok) throw new Error('failed');
        const body = (await res.json()) as ResultData;
        if (!cancelled) {
          setData(body);
          setStatus('ok');
          track('contest_result_view', { contest_id: contestId });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  const subjects = useMemo(() => {
    const s = data?.attempt?.sectionScores ?? {};
    return Object.entries(s).map(([name, v]) => ({
      name,
      score: v.score,
      totalMarks: v.total * 10, // display scale
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }));
  }, [data]);

  if (status === 'loading') return <Centered>Loading result…</Centered>;
  if (status === 'error') return <Centered>Couldn't load your result. Please try again.</Centered>;
  if (status === 'pending') {
    return (
      <Centered>
        <Trophy className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-black text-foreground mb-2">Results are being finalized</h2>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Rankings and ORBIT changes publish shortly after the contest ends — check back soon.
        </p>
        <NeuButton onClick={() => router.push('/dashboard')}>Back to dashboard</NeuButton>
      </Centered>
    );
  }

  const p = data?.personal;
  const mv = data?.orbitMovement;
  const attempt = data?.attempt;
  const up = (mv?.change ?? 0) >= 0;

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary">Result</div>
          <h1 className="text-2xl font-black text-foreground">{data?.contestName}</h1>
        </div>

        {/* ORBIT movement — prominent */}
        {data?.orbit && (
          <div className="neu-raised rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ORBIT</div>
              <div className="text-3xl font-black text-foreground tabular-nums">
                {data.orbit.rating}
                {data.orbit.provisional && <span className="text-xs text-muted-foreground ml-2">provisional</span>}
              </div>
              <div className="text-[11px] font-black text-primary uppercase tracking-wide">{data.orbit.tier}</div>
            </div>
            {mv && (
              <div className={cn('flex items-center gap-1.5 text-xl font-black', up ? 'text-emerald-500' : 'text-rose-500')}>
                {up ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {up ? '+' : ''}
                {mv.change}
              </div>
            )}
          </div>
        )}

        {/* Rank + score tiles */}
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={<Medal className="w-5 h-5" />} label="Rank" value={p ? `#${p.rank}` : '—'} sub={p ? `of ${p.totalRanked}` : ''} />
          <Tile icon={<Target className="w-5 h-5" />} label="Percentile" value={p ? `${p.percentile}` : '—'} />
          <Tile icon={<Trophy className="w-5 h-5" />} label="Score" value={attempt ? `${attempt.score}` : '—'} />
        </div>

        {/* Subject-wise */}
        {subjects.length > 0 && (
          <div className="neu-raised rounded-2xl p-5 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject-wise</div>
            {subjects.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-muted-foreground">{s.accuracy}% acc</span>
                  <span className="text-sm font-black text-primary tabular-nums">{s.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <NeuButton onClick={() => setShareOpen(true)} className="flex-1">
            <span className="inline-flex items-center gap-2 text-primary font-black text-[12px] uppercase tracking-wider">
              <Share2 className="w-4 h-4" /> Share
            </span>
          </NeuButton>
          <NeuButton onClick={() => router.push(`/contest/${contestId}/leaderboard`)} className="flex-1">
            <span className="font-black text-[12px] uppercase tracking-wider">Leaderboard</span>
          </NeuButton>
        </div>
      </div>

      {/* Rated participants get the ORBIT-centric growth card ("Beat my ORBIT",
          deep-link to the public landing where the next contest is surfaced).
          Un-rated (no orbit row) falls back to the generic score card. */}
      {data?.orbit ? (
        <ContestShareCard
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          studentName={user?.name ?? 'A student'}
          contestName={data?.contestName ?? 'Origin Weekly'}
          orbit={data.orbit}
          movement={mv ? { change: mv.change } : null}
          rank={p?.rank ?? null}
          totalRanked={p?.totalRanked ?? null}
          percentile={p?.percentile ?? null}
          score={attempt?.score ?? p?.score ?? null}
          accuracy={
            attempt && attempt.correct + attempt.incorrect > 0
              ? Math.round((attempt.correct / (attempt.correct + attempt.incorrect)) * 100)
              : null
          }
          shareUrl={getCanonicalSiteUrl()}
        />
      ) : (
        attempt && (
          <ShareableReportCard
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            studentName={user?.name ?? 'A student'}
            testName={data?.contestName ?? 'Origin Weekly'}
            dateLabel=""
            stats={{
              score: attempt.score,
              totalMarks: (attempt.correct + attempt.incorrect + attempt.unattempted) * 10,
              correct: attempt.correct,
              incorrect: attempt.incorrect,
              unattempted: attempt.unattempted,
              accuracy:
                attempt.correct + attempt.incorrect > 0
                  ? Math.round((attempt.correct / (attempt.correct + attempt.incorrect)) * 100)
                  : 0,
            }}
            subjects={subjects}
          />
        )
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="neu-raised rounded-2xl p-4 flex flex-col items-center text-center">
      <div className="text-primary mb-1">{icon}</div>
      <div className="text-lg font-black text-foreground tabular-nums">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      {sub && <div className="text-[9px] font-bold text-muted-foreground/70">{sub}</div>}
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
