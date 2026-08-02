'use client';

import Image from 'next/image';
import { Lock, Flame, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STREAK_BADGES } from '@/lib/streak-badges';

interface StreakCabinetProps {
  currentStreak: number;
  /** Best streak ever reached — badges are earned permanently off this. */
  longestStreak: number;
  /** Streak freezes left this month (optional). */
  freezesRemaining?: number;
  className?: string;
}

/**
 * Streak milestone badges (7 / 30 / 100 / 365 days). Earned off the best streak
 * ever reached; unearned show as faded silhouettes with the requirement. Header
 * shows the live streak + remaining freezes.
 */
export function StreakCabinet({ currentStreak, longestStreak, freezesRemaining, className }: StreakCabinetProps) {
  const earnedCount = STREAK_BADGES.filter((b) => longestStreak >= b.days).length;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-foreground leading-tight">Streak Badges</h3>
          <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{earnedCount} / {STREAK_BADGES.length} earned</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-500">
            <Flame className="h-3.5 w-3.5" /> {currentStreak}
          </span>
          {freezesRemaining != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-black text-sky-500" title="Streak freezes left this month">
              <Snowflake className="h-3.5 w-3.5" /> {freezesRemaining}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {STREAK_BADGES.map((b) => {
          const unlocked = longestStreak >= b.days;
          return (
            <div
              key={b.id}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all',
                unlocked ? 'border-border/50 bg-background/40 hover:-translate-y-0.5 hover:shadow-lg' : 'border-dashed border-border/40 bg-muted/10',
              )}
              title={unlocked ? `${b.title} — ${b.days}-day streak` : `Reach a ${b.days}-day streak to unlock`}
            >
              <div className={cn('relative h-14 w-14', !unlocked && 'grayscale opacity-30')}>
                <Image src={b.src} alt={`${b.days}-day streak badge`} fill sizes="56px" className="object-contain" />
              </div>
              {!unlocked && (
                <span className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground shadow-sm">
                  <Lock className="h-3 w-3" />
                </span>
              )}
              <div className="min-w-0">
                <p className={cn('text-xs font-black leading-none', unlocked ? 'text-foreground' : 'text-muted-foreground')}>{b.title}</p>
                <p className="mt-1 text-[9px] font-semibold leading-tight text-muted-foreground">
                  {unlocked ? `${b.days} days` : `${b.days}-day streak`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
