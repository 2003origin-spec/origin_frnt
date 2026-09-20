'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Sticky screen header: optional back, title, optional subtitle, actions.
 *
 * `top` is the safe-area inset, never 0 — on a notched phone a sticky header at
 * 0 slides under the status bar. Titles are sentence case (audit X-4); the
 * component does not uppercase anything.
 */
export function PageHeader({
  title,
  subtitle,
  back = false,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        'sticky z-[var(--z-sticky)] -mx-4 mb-4 flex items-start gap-3 border-b border-border bg-background/86 px-4 py-3 backdrop-blur',
        className,
      )}
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      {back ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-5" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate font-display text-2xl font-bold leading-none tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1 py-1">{actions}</div> : null}
    </header>
  );
}
