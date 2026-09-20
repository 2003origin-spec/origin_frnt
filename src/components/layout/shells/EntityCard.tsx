import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type Stat = { value: string | number; label: string };

/**
 * The card pattern the audit rated as the best-designed element already in the
 * app (the JEE Main mock on /tests): status chips, a display-face title, one
 * line of description, labelled stats, and exactly one unambiguous action.
 *
 * Extracted so the other 76 screens inherit it instead of reinventing it.
 * Note `action` is singular by design — the audit found screens whose primary
 * action competed with two or three neighbours.
 */
export function EntityCard({
  title,
  description,
  chips,
  stats,
  action,
  secondaryAction,
  className,
}: {
  title: string;
  description?: string;
  chips?: React.ReactNode;
  stats?: Stat[];
  action?: { label: string; onClick?: () => void; href?: string; disabled?: boolean };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <article className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-4', className)}>
      {chips ? <div className="flex flex-wrap items-center gap-2">{chips}</div> : null}
      <div>
        <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {stats?.length ? (
        <dl className="flex flex-wrap gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <dd className="font-display text-xl font-bold leading-none tabular-nums text-foreground">{s.value}</dd>
              <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {action || secondaryAction ? (
        <div className="flex flex-col gap-2">
          {action ? (
            action.href ? (
              <Button asChild className="w-full"><a href={action.href}>{action.label}</a></Button>
            ) : (
              <Button className="w-full" onClick={action.onClick} disabled={action.disabled}>{action.label}</Button>
            )
          ) : null}
          {secondaryAction ? (
            secondaryAction.href ? (
              <Button asChild variant="outline" className="w-full"><a href={secondaryAction.href}>{secondaryAction.label}</a></Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
            )
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export { Badge as CardChip };
