import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The empty / error / loading triad.
 *
 * `action` is REQUIRED on empty and error. Audit finding X-6: DPP's empty state
 * said "submit a test first so the analytics pipeline can generate targeted
 * DPPs" and gave no way to do it — developer vocabulary plus a dead end. A
 * state the user cannot leave is a bug, so the type system now insists on the
 * way out.
 */
type Common = { title: string; description?: string; className?: string };

export function EmptyState({
  title,
  description,
  action,
  className,
  /** Centre vertically in the remaining space. Use when this is the only thing
   *  on the screen — otherwise the card pins to the top and leaves ~1000px of
   *  dead space beneath it (audit X-7, measured on /dpp). */
  fill = false,
}: Common & {
  action: { label: string; onClick?: () => void; href?: string };
  fill?: boolean;
}) {
  return (
    <div className={cn(fill && 'flex min-h-[60dvh] flex-col justify-center')}>
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center', className)}>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      {description ? <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {action.href ? (
        <Button asChild><a href={action.href}>{action.label}</a></Button>
      ) : (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
    </div>
  );
}

export function ErrorState({
  title = 'That didn’t load',
  description = 'Check your connection and try again.',
  action,
  className,
}: Partial<Common> & { action: { label: string; onClick: () => void } }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-card px-6 py-10 text-center', className)} role="alert">
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button variant="outline" onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}

/** Shape-matched skeleton. Never a full-screen spinner — P1-9. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
