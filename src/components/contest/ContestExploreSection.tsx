'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trophy, ArrowRight, Dumbbell, BarChart3, Target, Award, Clock, CheckCircle2, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { track } from '@/lib/analytics';
import { getContestStatusAction, registerForContestAction } from '@/server/actions/contest-actions';
import type { ContestStatus } from '@/server/contest/contest-status';

/**
 * Dedicated Weekly Contest section for the Explore page. Surfaces the current
 * contest (live/upcoming state + register/enter CTA) and the contest's feature
 * set — Practice, Leaderboard, Practice-from-Mistakes (DPP), Result — plus a
 * short "how ORBIT works" explainer. Self-contained: fetches status client-side.
 */

function useCountdown(targetIso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return useMemo(() => {
    if (!targetIso) return null;
    const diff = Math.max(0, new Date(targetIso).getTime() - now);
    const s = Math.floor(diff / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  }, [targetIso, now]);
}

const FEATURES: { key: string; title: string; desc: string; icon: typeof Dumbbell; sub: (id: string) => string }[] = [
  { key: 'practice', title: 'Prep Practice', desc: 'Warm up on the contest topics with a live Prep Score.', icon: Dumbbell, sub: (id) => `/contest/${id}/practice` },
  { key: 'leaderboard', title: 'Leaderboard', desc: 'See where you rank against the whole field.', icon: BarChart3, sub: (id) => `/contest/${id}/leaderboard` },
  { key: 'dpp', title: 'Practice Mistakes', desc: 'A fresh set built from the questions you got wrong.', icon: Target, sub: (id) => `/contest/${id}/dpp` },
  { key: 'result', title: 'My Result', desc: 'Rank, percentile, score, and your ORBIT movement.', icon: Award, sub: (id) => `/contest/${id}/result` },
];

export function ContestExploreSection() {
  const router = useRouter();
  const [status, setStatus] = useState<ContestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void getContestStatusAction()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const contest = status?.contest ?? null;
  const startMs = contest?.startAt ? new Date(contest.startAt).getTime() : null;
  const endMs = contest?.endAt ? new Date(contest.endAt).getTime() : null;
  const isLive = startMs != null && endMs != null && nowMs >= startMs && nowMs < endMs;
  const isEnded = endMs != null && nowMs >= endMs;
  const countdown = useCountdown(isLive ? contest?.endAt ?? null : contest?.startAt ?? null);

  // Nothing to show if the feature is disabled entirely.
  if (!loading && (!status || !status.enabled)) return null;

  const onRegister = async () => {
    if (!contest || registering) return;
    setRegistering(true);
    try {
      const res = await registerForContestAction(contest.id);
      if (!res.alreadyRegistered) track('contest_register', { contest_id: contest.id });
      setStatus((prev) => (prev?.contest ? { ...prev, contest: { ...prev.contest, isRegistered: true } } : prev));
      if (isLive) {
        router.push(`/contest/${contest.id}/play`);
        return;
      }
      toast.success(res.alreadyRegistered ? "You're already registered." : "You're in! See you at the contest.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not register — please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const hasActive = Boolean(contest) && !isEnded;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-black text-foreground">Weekly Contest</h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2 py-0.5">ORBIT rated</span>
      </div>

      {/* Hero — current contest or an explainer when none is live */}
      <div className="neu-raised rounded-2xl p-5 sm:p-6">
        {hasActive && contest ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                  {isLive ? 'Live now' : 'Upcoming'}
                </span>
                {isLive && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-foreground truncate">{contest.name}</h3>
              <p className="text-[11px] font-bold text-muted-foreground">{contest.registeredCount.toLocaleString()} registered</p>
            </div>

            {countdown && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{isLive ? 'ends in' : 'starts in'}</span>
                <span className="text-lg font-black tabular-nums text-foreground">
                  {countdown.d > 0 ? `${countdown.d}d ` : ''}
                  {String(countdown.h).padStart(2, '0')}:{String(countdown.m).padStart(2, '0')}:{String(countdown.s).padStart(2, '0')}
                </span>
              </div>
            )}

            <div className="shrink-0">
              {contest.isRegistered && isLive ? (
                <NeuButton onClick={() => router.push(`/contest/${contest.id}/play`)} className="w-full sm:w-auto">
                  <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">Enter <ArrowRight className="w-3.5 h-3.5" /></span>
                </NeuButton>
              ) : contest.isRegistered ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-black uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Registered
                </div>
              ) : (
                <NeuButton onClick={onRegister} disabled={registering} className="w-full sm:w-auto">
                  <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">
                    {registering ? 'Registering…' : 'Register'} {!registering && <ArrowRight className="w-3.5 h-3.5" />}
                  </span>
                </NeuButton>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-black text-foreground">A new contest drops every week</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 max-w-xl">
                Compete against the whole field in a timed test, climb the leaderboard, and earn an ORBIT rating that
                moves with every contest. Registration opens a few days before each one — check back soon.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feature tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {FEATURES.map((f) => {
          const enabled = hasActive && contest;
          return (
            <button
              key={f.key}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && contest && router.push(f.sub(contest.id))}
              className={cn(
                'neu-raised rounded-2xl p-4 text-left flex flex-col gap-2 transition-colors',
                enabled ? 'neu-pressable cursor-pointer group' : 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-[13px] font-black text-foreground group-hover:text-primary transition-colors">{f.title}</div>
              <div className="text-[11px] text-muted-foreground leading-snug">{f.desc}</div>
            </button>
          );
        })}
      </div>

      {/* How ORBIT works — one line explainer */}
      <div className="neu-inset rounded-xl px-4 py-3 flex items-start gap-2">
        <Award className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
          <span className="text-foreground">ORBIT</span> is your competitive rating — it goes up when you beat the field
          and settles as you play more contests. Provisional at first, then locks in across ~3 contests.
        </p>
      </div>
    </section>
  );
}
