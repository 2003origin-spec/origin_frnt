'use client';

import Link from 'next/link';
import { ArrowRight, Gauge } from 'lucide-react';

/**
 * Tests hub entry to the Rank Predictor (plan §9.3). Rendered only when the
 * rankPredictor flag is on — the parent decides on the server.
 */
export default function RankPredictorEntryCard() {
  return (
    <Link
      href="/rank-predictor"
      className="mb-6 flex min-h-16 items-center gap-4 rounded-[18px] border border-border bg-card p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary/15">
        <Gauge aria-hidden className="size-5 text-primary" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-foreground">What rank would this score get?</span>
        <span className="text-[13px] text-muted-foreground">Rank Predictor for NEET, JEE Main and JEE Advanced. Free.</span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
