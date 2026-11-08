'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { NotesAccess, NotesEffectiveAccess, NotesFolderStatus, NotesItemStatus } from '@/lib/notes/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Tone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Btn({
  tone = 'secondary',
  busy = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={busy || rest.disabled}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
        tone === 'secondary' && 'border border-border bg-surface-1 hover:bg-surface-2',
        tone === 'danger' && 'border border-destructive/40 text-destructive hover:bg-destructive/10',
        tone === 'ghost' && 'hover:bg-surface-2',
        className,
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconBtn({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30', className)}
    >
      {children}
    </button>
  );
}

const ITEM_STATUS: Record<NotesItemStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-surface-3 text-muted-foreground' },
  in_review: { label: 'In review', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  published: { label: 'Published', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
};

export function StatusChip({ status, hidden }: { status: NotesItemStatus | NotesFolderStatus; hidden?: boolean }) {
  const meta = ITEM_STATUS[status as NotesItemStatus] ?? ITEM_STATUS.draft;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.className)}>{meta.label}</span>
      {hidden && status === 'published' && (
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" title="A folder above this one is still a draft">
          Not visible yet
        </span>
      )}
    </span>
  );
}

export function AccessChip({ access, effective }: { access: NotesAccess; effective: NotesEffectiveAccess }) {
  const label = access === 'inherit' ? `${effective === 'premium' ? 'Premium' : 'Free'} (from folder)` : access === 'premium' ? 'Premium' : 'Free';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', effective === 'premium' ? 'bg-primary/15 text-primary' : 'bg-surface-3 text-muted-foreground')}>
      {label}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', wide ? 'max-w-2xl' : 'max-w-md')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm outline-none focus:border-primary disabled:opacity-60';

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[18px] border border-border bg-surface-1 p-4', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorLine({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Team rule: dd/mm/yyyy, IST.
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
