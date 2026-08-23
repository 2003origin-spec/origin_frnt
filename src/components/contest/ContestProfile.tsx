'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Award, Flame, Trophy, Star, Coins, TrendingUp, TrendingDown, Loader2, Medal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { getContestProfileAction } from '@/server/actions/contest-actions';
import type { ContestProfile as Profile } from '@/server/contest/contest-profile-service';

/**
 * The student's contest profile — ORBIT rating + tier + best, streak, badges,
 * personal bests, OGCode rewards earned, and per-contest history (each links to
 * its result). Surfaces data the pipeline already produces (Phase 8 gamification
 * + Phase 7 ORBIT) that previously had no home.
 */

const BADGE_META: Record<string, { label: string; icon: string }> = {
  top_1_percent: { label: 'Top 1%', icon: '🏆' },
  speedster: { label: 'Speedster', icon: '⚡' },
  sharpshooter: { label: 'Sharpshooter', icon: '🎯' },
  comeback: { label: 'Comeback', icon: '🔥' },
  origin_legend: { label: 'Origin Legend', icon: '🌟' },
};

function tierAccent(tier: string): string {
  const map: Record<string, string> = {
    Explorer: '#94a3b8', Challenger: '#38bdf8', Contender: '#22d3ee', Advanced: '#34d399',
    Expert: '#a78bfa', Elite: '#f472b6', Master: '#fb923c', 'Origin Legend': '#fbbf24',
  };
  return map[tier] ?? '#3b82f6';
}

export function ContestProfile() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null | 'loading' | 'error'>('loading');

  useEffect(() => {
    getContestProfileAction()
      .then((data) => setP(data))
      .catch(() => setP('error'));
  }, []);

  if (p === 'loading') return <Centered><Loader2 className="w-8 h-8 animate-spin text-primary" /></Centered>;
  if (p === 'error') return <Centered>Couldn&apos;t load your contest profile.</Centered>;
  if (!p) return <Centered>Sign in to see your ORBIT profile.</Centered>;

  const accent = p.orbit ? tierAccent(p.orbit.tier) : '#3b82f6';

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> My ORBIT
          </h1>
          <button
            type="button"
            onClick={() => router.push('/contest/rankings')}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-primary"
          >
            Rankings <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ORBIT hero */}
        <div className="neu-raised rounded-2xl p-6 text-center">
          {p.orbit ? (
            <>
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ORBIT rating</div>
              <div className="text-6xl font-black tabular-nums mt-1" style={{ color: accent }}>{Math.round(p.orbit.rating)}</div>
              <div className="text-[12px] font-black uppercase tracking-wide mt-1" style={{ color: accent }}>
                {p.orbit.tier}{p.orbit.provisional ? ' · provisional' : ''}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-[11px] font-bold text-muted-foreground">
                {p.orbit.highestRating != null && <span>Peak {Math.round(p.orbit.highestRating)}</span>}
                <span>{p.contestsPlayed} contests</span>
                {p.orbit.ratingChange != null && (
                  <span className={cn('inline-flex items-center gap-1', p.orbit.ratingChange >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                    {p.orbit.ratingChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {p.orbit.ratingChange >= 0 ? '+' : ''}{p.orbit.ratingChange} last
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              Play your first contest to earn an ORBIT rating. Provisional for ~3 contests, then it locks in.
            </div>
          )}
        </div>

        {/* Stat strip: streak · rewards · best rank */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Flame className="w-4 h-4 text-orange-500" />} label="Streak" value={`${p.streak.current}`} sub={p.streak.longest ? `best ${p.streak.longest}` : ''} />
          <Stat icon={<Coins className="w-4 h-4 text-amber-500" />} label="OGCode earned" value={p.totalRewardPoints.toLocaleString()} />
          <Stat icon={<Medal className="w-4 h-4 text-primary" />} label="Best rank" value={p.personalBest?.bestRank ? `#${p.personalBest.bestRank}` : '—'} sub={p.personalBest?.bestPercentile != null ? `${Math.round(p.personalBest.bestPercentile)}%ile` : ''} />
        </div>

        {/* Badges */}
        {p.badges.length > 0 && (
          <div className="neu-raised rounded-2xl p-5">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500" /> Badges
            </div>
            <div className="flex flex-wrap gap-2">
              {p.badges.map((b) => {
                const meta = BADGE_META[b.badge] ?? { label: b.badge, icon: '🏅' };
                return (
                  <span key={b.badge} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-inset text-[12px] font-black text-foreground">
                    <span className="text-base">{meta.icon}</span> {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Contest history */}
        <div className="neu-raised rounded-2xl p-5">
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> Past contests
          </div>
          {p.history.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">No finished contests yet.</div>
          ) : (
            <div className="divide-y divide-border/30">
              {p.history.map((h) => {
                const up = (h.ratingChange ?? 0) >= 0;
                return (
                  <button
                    key={h.contestId}
                    type="button"
                    onClick={() => router.push(`/contest/${h.contestId}/result`)}
                    className="w-full flex items-center justify-between py-3 text-left group"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{h.name}</div>
                      <div className="text-[11px] font-bold text-muted-foreground">
                        {h.rank ? `Rank #${h.rank}` : '—'}{h.percentile != null ? ` · ${Math.round(h.percentile)}%ile` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {h.ratingChange != null && (
                        <span className={cn('text-[12px] font-black tabular-nums', up ? 'text-emerald-500' : 'text-rose-500')}>
                          {up ? '+' : ''}{h.ratingChange}
                        </span>
                      )}
                      {h.ratingAfter != null && <span className="text-[13px] font-black text-foreground tabular-nums">{h.ratingAfter}</span>}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="neu-raised rounded-2xl p-3 flex flex-col items-center text-center">
      <div className="mb-1">{icon}</div>
      <div className="text-lg font-black text-foreground tabular-nums">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      {sub && <div className="text-[9px] font-bold text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6 text-foreground">{children}</div>;
}
