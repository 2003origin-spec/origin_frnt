'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trophy, ArrowRight, CheckCircle2, Clock, Dumbbell, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { track } from '@/lib/analytics';
import { getOpenContestsAction, registerForContestAction } from '@/server/actions/contest-actions';
import type { ContestSummary } from '@/server/contest/contest-status';

/**
 * All currently-available contests (live + upcoming). Fixes the "only one contest
 * visible" gap — every simultaneously-hosted contest is listed here with its own
 * register/enter CTA. Reached from the banner / Explore "See all contests".
 */
export function ContestList() {
  const router = useRouter();
  const [contests, setContests] = useState<ContestSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = () =>
    getOpenContestsAction()
      .then((list) => setContests(list))
      .catch(() => setContests([]));

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const register = async (c: ContestSummary) => {
    setBusy(c.id);
    try {
      const res = await registerForContestAction(c.id);
      if (!res.alreadyRegistered) track('contest_register', { contest_id: c.id });
      const live = liveState(c, Date.now()).isLive;
      if (live) {
        router.push(`/contest/${c.id}/play`);
        return;
      }
      toast.success(res.alreadyRegistered ? "You're already registered." : "You're in! See you at the contest.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not register — please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Weekly Contests
          </h1>
        </div>

        {contests === null ? (
          <div className="neu-raised rounded-2xl p-8 flex items-center justify-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading contests…
          </div>
        ) : contests.length === 0 ? (
          <div className="neu-raised rounded-2xl p-8 text-center">
            <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-foreground mb-1">No contests open right now</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              A new Origin Weekly drops regularly. Registration opens a few days before each one — check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contests.map((c) => (
              <ContestRow key={c.id} contest={c} nowMs={nowMs} busy={busy === c.id} onRegister={() => register(c)} onEnter={() => router.push(`/contest/${c.id}/play`)} onPractice={() => router.push(`/contest/${c.id}/practice`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function liveState(c: ContestSummary, nowMs: number) {
  const start = c.startAt ? new Date(c.startAt).getTime() : null;
  const end = c.endAt ? new Date(c.endAt).getTime() : null;
  const isLive = start != null && end != null && nowMs >= start && nowMs < end;
  return { isLive, target: isLive ? c.endAt : c.startAt };
}

function ContestRow({
  contest,
  nowMs,
  busy,
  onRegister,
  onEnter,
  onPractice,
}: {
  contest: ContestSummary;
  nowMs: number;
  busy: boolean;
  onRegister: () => void;
  onEnter: () => void;
  onPractice: () => void;
}) {
  const { isLive, target } = liveState(contest, nowMs);
  const countdown = useMemo(() => {
    if (!target) return null;
    const diff = Math.max(0, new Date(target).getTime() - nowMs);
    const s = Math.floor(diff / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  }, [target, nowMs]);

  return (
    <div className="neu-raised rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-primary">{isLive ? 'Live now' : 'Upcoming'}</span>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          )}
        </div>
        <h3 className="text-base font-black text-foreground truncate">{contest.name}</h3>
        <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
          <span>{contest.registeredCount.toLocaleString()} registered</span>
          {countdown && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isLive ? 'ends' : 'starts'} in{' '}
              <span className="tabular-nums text-foreground font-black">
                {countdown.d > 0 ? `${countdown.d}d ` : ''}
                {String(countdown.h).padStart(2, '0')}:{String(countdown.m).padStart(2, '0')}:{String(countdown.s).padStart(2, '0')}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        {contest.isRegistered && isLive ? (
          <NeuButton onClick={onEnter} className="w-full sm:w-auto">
            <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">Enter <ArrowRight className="w-3.5 h-3.5" /></span>
          </NeuButton>
        ) : contest.isRegistered ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> Registered
            </div>
            <NeuButton onClick={onPractice} className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-1.5 text-primary font-black uppercase tracking-wider text-[11px]"><Dumbbell className="w-3.5 h-3.5" /> Practice</span>
            </NeuButton>
          </>
        ) : (
          <NeuButton onClick={onRegister} disabled={busy} className={cn('w-full sm:w-auto')}>
            <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">
              {busy ? 'Registering…' : 'Register'} {!busy && <ArrowRight className="w-3.5 h-3.5" />}
            </span>
          </NeuButton>
        )}
      </div>
    </div>
  );
}
