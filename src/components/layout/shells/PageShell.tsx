import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The base mobile page. Every student screen should sit inside one.
 *
 * It owns the three things that used to be re-derived (and re-broken) per
 * screen — safe-area insets, the bottom-nav offset, and the viewport-height
 * model. P0-17 in MOBILE_UI_REDESIGN_PLAN was exactly this: a `flex-1 min-h-0`
 * put the bottom of every scrollable page out of reach. Screens that compose
 * this cannot reintroduce it.
 *
 * Reading width is capped at --measure-max so long text does not run the full
 * width of a tablet.
 */
export function PageShell({
  children,
  className,
  width = 'default',
  gutter = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** 'prose' caps to --measure-max for text-heavy screens (solutions, legal). */
  width?: 'default' | 'prose' | 'full';
  gutter?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-h-dvh w-full pb-mobile-nav',
        gutter && 'px-4',
        width === 'default' && 'mx-auto max-w-2xl',
        width === 'prose' && 'mx-auto max-w-[68ch]',
        className,
      )}
    >
      {children}
    </div>
  );
}
