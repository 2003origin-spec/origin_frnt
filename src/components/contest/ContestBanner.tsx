'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, X, ArrowRight, CheckCircle2, Clock, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

import { NeuButton } from '@/components/ui/neu';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
  getOpenContestsAction,
  registerForContestAction,
} from '@/server/actions/contest-actions';
import type { ContestStatus, ContestSummary } from '@/server/contest/contest-status';

/**
 * Weekly Contest register banner (plan Phase 2). Shown on the dashboard
 * (server-seeded via `initial`) and the landing page (client-fetched, no
 * `initial`). The countdown is PURE client arithmetic against the UTC start_at
 * — it never calls the server per tick. Dismissible per-user-per-contest.
 */

function useCountdown(targetIso: string | null): { d: number; h: number; m: number; s: number; done: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return useMemo(() => {
    if (!targetIso) return { d: 0, h: 0, m: 0, s: 0, done: true };
    const diff = Math.max(0, new Date(targetIso).getTime() - now);
    const s = Math.floor(diff / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
      done: diff <= 0,
    };
  }, [targetIso, now]);
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg sm:text-xl font-black tabular-nums leading-none text-foreground">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export function ContestBanner({ initial, userId }: { initial?: ContestStatus | null; userId?: string | null }) {
  const router = useRouter();
  // ALL open contests (live + upcoming). Seeded from the server single for an
  // instant first paint, then replaced by the full list so the banner reflects
  // every hosted contest — and features the RIGHT one for this candidate.
  const [contests, setContests] = useState<ContestSummary[] | null>(
    initial?.contest ? [initial.contest] : initial?.enabled === false ? [] : null,
  );
  const [registering, setRegistering] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we know it isn't dismissed

  // Fetch the full open-contest list (both dashboard + landing).
  useEffect(() => {
    let cancelled = false;
    void getOpenContestsAction()
      .then((list) => { if (!cancelled) setContests(list); })
      .catch(() => { if (!cancelled) setContests([]); });
    return () => { cancelled = true; };
  }, []);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = (c: ContestSummary) => {
    const s = c.startAt ? new Date(c.startAt).getTime() : null;
    const e = c.endAt ? new Date(c.endAt).getTime() : null;
    return s != null && e != null && nowMs >= s && nowMs < e;
  };
  const ended = (c: ContestSummary) => {
    const e = c.endAt ? new Date(c.endAt).getTime() : null;
    return e != null && nowMs >= e;
  };
  const startMsOf = (c: ContestSummary) => (c.startAt ? new Date(c.startAt).getTime() : Infinity);

  // Pick the contest to FEATURE for this candidate, by priority:
  //   1. registered + live      → attend now
  //   2. not-registered + live  → join now (walk-up)
  //   3. registered + upcoming  → practice (soonest)
  //   4. nearest upcoming       → register
  const open = (contests ?? []).filter((c) => !ended(c));
  const contest =
    open.filter((c) => c.isRegistered && live(c)).sort((a, b) => startMsOf(a) - startMsOf(b))[0] ??
    open.filter((c) => live(c)).sort((a, b) => startMsOf(a) - startMsOf(b))[0] ??
    open.filter((c) => c.isRegistered).sort((a, b) => startMsOf(a) - startMsOf(b))[0] ??
    open.sort((a, b) => startMsOf(a) - startMsOf(b))[0] ??
    null;

  const storeKey = contest && userId ? `contest_banner_dismissed_${userId}_${contest.id}` : null;
  useEffect(() => {
    if (!storeKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(localStorage.getItem(storeKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storeKey]);

  const isLive = contest ? live(contest) : false;
  const countdown = useCountdown(contest ? (isLive ? contest.endAt : contest.startAt) : null);

  if (!contest || dismissed) return null;

  const otherCount = open.length - 1; // additional contests beyond the featured one

  const dismiss = () => {
    setDismissed(true);
    try {
      if (storeKey) localStorage.setItem(storeKey, '1');
    } catch {
      /* ignore */
    }
  };

  const markRegistered = (id: string) =>
    setContests((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, isRegistered: true, registeredCount: c.registeredCount + 1 } : c)) : prev));

  const onRegister = async () => {
    if (registering || !contest) return;
    // Logged-out visitor (landing page): route to sign-in instead of a 401.
    if (!userId) {
      const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      router.push(`/auth?next=${encodeURIComponent(back)}`);
      return;
    }
    setRegistering(true);
    try {
      const res = await registerForContestAction(contest.id);
      if (!res.alreadyRegistered) { track('contest_register', { contest_id: contest.id }); markRegistered(contest.id); }
      // Walk-up: registered during a LIVE contest → jump straight into the attempt.
      if (isLive) {
        toast.success("You're in — entering the contest!");
        router.push(`/contest/${contest.id}/play`);
        return;
      }
      toast.success(res.alreadyRegistered ? "You're already registered." : "You're in! See you at the contest.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not register — please try again.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="relative neu-raised rounded-2xl p-4 sm:p-5 overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss contest banner"
        className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-primary/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                {isLive ? 'Live now' : 'Weekly Contest'}
              </span>
              {isLive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-foreground truncate">{contest.name}</h3>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                {contest.registeredCount.toLocaleString()} registered
              </p>
              {otherCount > 0 && (
                <button
                  type="button"
                  onClick={() => router.push('/contest')}
                  className="text-[11px] font-black uppercase tracking-wider text-primary"
                >
                  +{otherCount} more
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-3 sm:ml-auto">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">{isLive ? 'ends in' : 'starts in'}</span>
          </div>
          <div className="flex items-center gap-2.5 neu-inset rounded-xl px-3 py-2">
            {countdown.d > 0 && <Segment value={countdown.d} label="days" />}
            <Segment value={countdown.h} label="hrs" />
            <Segment value={countdown.m} label="min" />
            <Segment value={countdown.s} label="sec" />
          </div>
        </div>

        {/* CTA */}
        <div className="sm:ml-2">
          {contest.isRegistered && isLive ? (
            // Registered + the contest is live → jump straight into the attempt.
            <NeuButton onClick={() => router.push(`/contest/${contest.id}/play`)} className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">
                Enter contest <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </NeuButton>
          ) : contest.isRegistered ? (
            // Registered + upcoming → warm up with OGCode practice (registered-only).
            <div className="flex flex-col items-stretch sm:items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Registered
              </span>
              <NeuButton onClick={() => router.push(`/contest/${contest.id}/practice`)} className="w-full sm:w-auto">
                <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">
                  <Dumbbell className="w-3.5 h-3.5" /> Practice now
                </span>
              </NeuButton>
            </div>
          ) : (
            <NeuButton onClick={onRegister} disabled={registering} className={cn('w-full sm:w-auto')}>
              <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider text-[12px]">
                {registering ? 'Registering…' : 'Register'}
                {!registering && <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </NeuButton>
          )}
        </div>
      </div>
    </div>
  );
}
