'use client';

/**
 * The one screen every not-yet-built destination shares.
 *
 * The 2026-09-21 home mockup puts two features in the chrome that do not exist
 * (Snap & Solve in the centre nav, Mindmaps on the dashboard) and one that is
 * flag-dark in production (Orbit). Rather than render dead buttons, each opens
 * this: it says what the thing will do and hands the student something that
 * works right now, so the tap is never wasted.
 */

import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

export interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  /** One sentence: what this will do once it ships. */
  description: string;
  /** Two to four concrete capabilities. Keep each under ~8 words. */
  bullets?: string[];
  /** Somewhere useful to go instead. Omitted only when nothing fits. */
  action?: { label: string; onClick: () => void };
  /** Ori expression file under /ori2d. */
  mascot?: string;
}

export default function ComingSoon({
  icon: Icon,
  title,
  description,
  bullets,
  action,
  mascot = '/ori2d/ori-curious.png',
}: ComingSoonProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center">
      <Image
        src={mascot}
        alt=""
        aria-hidden
        width={112}
        height={112}
        className="h-24 w-24 object-contain drop-shadow-md"
        priority
      />

      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-primary">
        Coming soon
      </span>

      <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
        <Icon className="h-6 w-6 text-primary" aria-hidden />
        {title}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

      {bullets?.length ? (
        <ul className="mt-6 w-full space-y-2 text-left">
          {bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground"
            >
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
