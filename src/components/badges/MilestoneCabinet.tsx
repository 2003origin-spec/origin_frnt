'use client';

import Image from 'next/image';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MILESTONE_BADGES, getNextMilestone } from '@/lib/milestone-badges';

interface MilestoneCabinetProps {
  /** Total questions solved (sum of contributionData counts). */
  totalSolved: number;
  /** Compact grid for tight surfaces (e.g. public profile). */
  compact?: boolean;
  className?: string;
}

/**
 * "Questions Mastered" trophy cabinet. Earned badges are full-colour; unearned
 * show as faded grayscale silhouettes with the unlock requirement — locked
 * badges create the aspiration, so we always show all of them.
 */
export function MilestoneCabinet({ totalSolved, compact = false, className }: MilestoneCabinetProps) {
  const unlockedCount = MILESTONE_BADGES.filter((m) => totalSolved >= m.solved).length;
  const next = getNextMilestone(totalSolved);
  const prevThreshold = next ? [...MILESTONE_BADGES].reverse().find((m) => m.solved < next.solved && totalSolved >= m.solved)?.solved ?? 0 : 0;
  const progressPct = next
    ? Math.min(100, Math.round(((totalSolved - prevThreshold) / (next.solved - prevThreshold)) * 100))
    : 100;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-foreground leading-tight">Questions Mastered</h3>
          <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
            {unlockedCount} / {MILESTONE_BADGES.length} badges unlocked
          </p>
        </div>
        {next ? (
          <div className="text-right min-w-[7.5rem]">
            <p className="text-[10px] font-bold text-muted-foreground">
              <span className="text-foreground font-black tabular-nums">{totalSolved.toLocaleString('en-IN')}</span>
              {' / '}
              {next.solved.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-primary">
              {(next.solved - totalSolved).toLocaleString('en-IN')} to {next.label}
            </p>
          </div>
        ) : (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            All unlocked 🏆
          </span>
        )}
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6')}>
        {MILESTONE_BADGES.map((m) => {
          const unlocked = totalSolved >= m.solved;
          return (
            <div
              key={m.id}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all',
                unlocked
                  ? 'border-border/50 bg-background/40 hover:-translate-y-0.5 hover:shadow-lg'
                  : 'border-dashed border-border/40 bg-muted/10',
              )}
              title={unlocked ? `${m.label} — ${m.tagline}` : `Solve ${m.solved.toLocaleString('en-IN')} questions to unlock`}
            >
              <div className={cn('relative h-14 w-14', !unlocked && 'grayscale opacity-30')}>
                <Image src={m.src} alt={`${m.label} questions mastered`} fill sizes="56px" className="object-contain" />
              </div>
              {!unlocked && (
                <span className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground shadow-sm">
                  <Lock className="h-3 w-3" />
                </span>
              )}
              <div className="min-w-0">
                <p className={cn('text-xs font-black leading-none', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                  {m.label}
                </p>
                <p className="mt-1 text-[9px] font-semibold leading-tight text-muted-foreground line-clamp-2">
                  {unlocked ? m.tagline : `Solve ${m.solved.toLocaleString('en-IN')}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
