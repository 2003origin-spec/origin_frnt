'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };

/**
 * One horizontally-scrolling row of filter chips.
 *
 * Fixes audit finding "Tests: seven tabs wrapping onto two rows" — a wrapped
 * tab bar hides the fact that a second row exists. A single scrolling row makes
 * overflow visible and reachable with a thumb. Chips are 44px+ tall.
 */
export function FilterBar({
  options,
  value,
  onChange,
  className,
  label = 'Filter',
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
              active
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {o.label}
            {typeof o.count === 'number' ? (
              <span className={cn('text-xs tabular-nums', active ? 'opacity-80' : 'opacity-70')}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
