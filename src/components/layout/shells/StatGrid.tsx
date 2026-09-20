import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Stat } from './EntityCard';

/**
 * The dashboard stat tiles. Two columns on a phone.
 *
 * Deliberately has no slot for decoration: the audit found the Ori mascot
 * rendered inside all four dashboard stat cards at once (X-2), carrying no
 * information and covering the values. There is nowhere to put it here.
 */
export function StatGrid({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3', className)}>
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
          <dd className="font-display text-2xl font-bold leading-none tabular-nums text-foreground">{s.value}</dd>
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
