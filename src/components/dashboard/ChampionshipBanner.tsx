'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Trophy, X, ChevronsUp, Flame } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { NeuButton } from '@/components/ui/neu';
import { cn } from '@/lib/utils';

// Prize photo + label are set by an admin at /admin/championship (stored in
// platform settings, delivered in the snapshot). A trophy shows until then.
const DEFAULT_PRIZE_LABEL = 'Winner merch + a founders’ letter';

interface ChampionEntry {
  userId: string;
  name: string;
  avatar: string | null;
  points: number;
  rank: number;
}
interface ChampionshipSnapshot {
  myRank: number | null;
  myPoints: number;
  totalStudents: number;
  top3: ChampionEntry[];
  rivalAbove: ChampionEntry | null;
  pointsToClimb: number | null;
  prizeImageUrl: string | null;
  prizeLabel: string | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function daysLeftInMonth(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
  return Math.max(0, end.getDate() - now.getDate());
}

function monthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monthly Championship banner (retention Layer 4). Surfaces the merch/mentorship
 * competition that was previously invisible in-app: the viewer's standing, the
 * named rival directly above them ("solve N to climb"), the top-3, and days left
 * in the month. Ranking is the all-time prestige leaderboard; the month framing
 * is the prize window. Dismissible per-user, per-month.
 */
export function ChampionshipBanner({ onPractice }: { onPractice: () => void }) {
  const { user } = useAuth();
  const [snap, setSnap] = useState<ChampionshipSnapshot | null>(null);
  const [dismissed, setDismissed] = useState(true); // start hidden until we know it isn't dismissed
  const [prizeBroken, setPrizeBroken] = useState(false);
  const daysLeft = useMemo(() => daysLeftInMonth(), []);
  const storeKey = user ? `championship_dismissed_${user.id}_${monthKey()}` : null;

  useEffect(() => {
    if (!storeKey) return;
    try {
      setDismissed(localStorage.getItem(storeKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storeKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await apiCall('/assessments/ogcode/championship/', { silentAuth: true })) as ChampionshipSnapshot;
        if (!cancelled) setSnap(data);
      } catch {
        /* leave hidden on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      if (storeKey) localStorage.setItem(storeKey, '1');
    } catch {
      /* ignore */
    }
  };

  // Hide until we have a real board (at least one ranked student).
  if (dismissed || !snap || snap.totalStudents === 0) return null;

  const { myRank, totalStudents, rivalAbove, pointsToClimb, top3 } = snap;

  return (
    <div className="neu-raised relative overflow-hidden rounded-2xl p-4 sm:p-5">
      {/* accent wash */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />

      <button
        onClick={dismiss}
        className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-muted-foreground/70 transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        aria-label="Dismiss championship banner"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Prize */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1.5 sm:pr-4 sm:border-r sm:border-border/40">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/25">
            {snap.prizeImageUrl && !prizeBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snap.prizeImageUrl} alt="Prize" className="h-full w-full object-cover" onError={() => setPrizeBroken(true)} />
            ) : (
              <Trophy className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <p className="text-[10px] font-bold leading-tight text-muted-foreground sm:max-w-[6.5rem] sm:text-center">{snap.prizeLabel || DEFAULT_PRIZE_LABEL}</p>
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-black tracking-tight text-foreground">Monthly Championship</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </span>
          </div>

          {/* Standing + rival */}
          <div className="text-[13px] font-semibold leading-snug text-foreground">
            {myRank ? (
              <>
                You’re <span className="font-black text-primary">#{myRank}</span>
                <span className="text-muted-foreground"> of {totalStudents.toLocaleString('en-IN')}</span>.{' '}
                {rivalAbove && pointsToClimb != null ? (
                  <span>
                    <span className="font-black">{rivalAbove.name}</span> is just ahead — solve{' '}
                    <span className="font-black text-amber-600 dark:text-amber-400">{pointsToClimb.toLocaleString('en-IN')} pts</span>{' '}
                    to reach <span className="font-black">#{rivalAbove.rank}</span>.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-black text-amber-600 dark:text-amber-400">
                    <Flame className="h-3.5 w-3.5" /> You’re leading — defend your crown!
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Solve questions to enter this month’s championship and climb the ranks.</span>
            )}
          </div>

          {/* Top 3 + CTA */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {top3.map((e, i) => (
                <span key={e.userId} className={cn('inline-flex items-center gap-1 text-[11px] font-bold', e.userId === user?.id ? 'text-primary' : 'text-muted-foreground')}>
                  <span>{MEDALS[i]}</span>
                  <span className="max-w-[7rem] truncate">{e.name}</span>
                  <span className="tabular-nums opacity-70">{e.points.toLocaleString('en-IN')}</span>
                </span>
              ))}
            </div>
            <NeuButton accent onClick={onPractice} className="ml-auto h-8 gap-1.5 px-4 text-xs">
              <ChevronsUp className="h-3.5 w-3.5" />
              Solve to climb
            </NeuButton>
          </div>
        </div>
      </div>
    </div>
  );
}
