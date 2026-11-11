'use client';

import { ArrowRight } from 'lucide-react';

/**
 * Hero chip "Free · Rank Predictor →" (plan §9.2). A plain #rank-predictor
 * link, so it still works before the widget's chunk has loaded; with the widget
 * on screen it scrolls there (instantly under reduced motion) and moves focus
 * to the section heading for keyboard and screen-reader users.
 */
export default function RankPredictorChip() {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById('rank-predictor');
    if (!section) return; // Let the browser follow the hash.
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    section.querySelector<HTMLElement>('h2[tabindex="-1"]')?.focus({ preventScroll: true });
  };
  return (
    <div className="mt-3 flex w-full justify-center">
      <a
        href="#rank-predictor"
        aria-label="Free Rank Predictor"
        onClick={onClick}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1.5 pr-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="rounded-full bg-primary px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-primary-foreground">Free</span>
        Rank Predictor
        <ArrowRight aria-hidden className="size-4" />
      </a>
    </div>
  );
}
