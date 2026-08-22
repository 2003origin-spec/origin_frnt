'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, X, ArrowRight, CheckCircle2, Clock, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

import { NeuButton } from '@/components/ui/neu';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
  getContestStatusAction,
  registerForContestAction,
} from '@/server/actions/contest-actions';
import type { ContestStatus } from '@/server/contest/contest-status';

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
  const [status, setStatus] = useState<ContestStatus | null>(initial ?? null);
  const [registering, setRegistering] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we know it isn't dismissed

  const contest = status?.contest ?? null;
  const storeKey = contest && userId ? `contest_banner_dismissed_${userId}_${contest.id}` : null;

  // Client-fetch when not server-seeded (landing page).
  useEffect(() => {
    if (initial !== undefined && initial !== null) return;
    let cancelled = false;
    void getContestStatusAction()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial]);

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

  const isLive = contest?.state === 'LIVE';
  const countdown = useCountdown(isLive ? contest?.endAt ?? null : contest?.startAt ?? null);

  if (!status?.enabled || !contest || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      if (storeKey) localStorage.setItem(storeKey, '1');
    } catch {
      /* ignore */
    }
  };

  const onRegister = async () => {
    if (registering) return;
    // Logged-out visitor (landing page): registration needs an account. Route to
    // sign-in with a return path instead of firing an action that would 401.
    if (!userId) {
      const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      router.push(`/auth?next=${encodeURIComponent(back)}`);
      return;
    }
    setRegistering(true);
    try {
      const res = await registerForContestAction(contest.id);
      if (!res.alreadyRegistered) track('contest_register', { contest_id: contest.id });
      setStatus((prev) =>
        prev?.contest
          ? { ...prev, contest: { ...prev.contest, isRegistered: true, registeredCount: prev.contest.registeredCount + (res.alreadyRegistered ? 0 : 1) } }
          : prev,
      );
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-foreground truncate">{contest.name}</h3>
            <p className="text-[11px] font-bold text-muted-foreground">
              {contest.registeredCount.toLocaleString()} registered
            </p>
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
