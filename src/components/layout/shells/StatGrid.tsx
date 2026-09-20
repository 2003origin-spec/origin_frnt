import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Stat } from './EntityCard';

export type StatTile = Stat & {
  /** Meaning-bearing icon (subject, streak, rank). NOT decoration. */
  icon?: React.ReactNode;
};

/**
 * The dashboard stat tiles. Two columns on a phone.
 *
 * The icon slot takes an ICON — something that helps you find the tile you want
 * at a glance. It deliberately cannot take arbitrary children: the audit found
 * the Ori mascot rendered inside all four dashboard tiles at once (X-2),
 * carrying no information and sitting on top of the values. There is nowhere
 * to put that here, and that is the point.
 */
export function StatGrid({ stats, className }: { stats: StatTile[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3', className)}>
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
          {s.icon ? <div className="mb-0.5 [&>svg]:size-4">{s.icon}</div> : null}
          <dd className="font-display text-2xl font-bold leading-none tabular-nums text-foreground">{s.value}</dd>
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
