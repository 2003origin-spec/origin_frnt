'use client';

/**
 * Origin Notes (student) — shared pieces: page frame, rows, chips, states.
 * OLED Material tokens; every tap target is at least 48px tall.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Lock,
  NotebookPen,
  RotateCcw,
  Sigma,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes, subjectLabel } from '@/lib/notes/rules';
import { chapterLabel } from '@/lib/notes/syllabus';
import type { NotesCrumb, NotesExam, NotesFolderCard, NotesItemCard, NotesNoteType, NotesSubject } from '@/lib/notes/types';

const SUBJECT_TONES: Record<NotesSubject, string> = {
  physics: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  chemistry: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  mathematics: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  biology: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export function subjectTone(subject: NotesSubject | null): string {
  return subject ? SUBJECT_TONES[subject] : 'bg-primary/15 text-primary';
}

const NOTE_TYPE_META: Record<NotesNoteType, { label: string; Icon: LucideIcon }> = {
  formula_sheet: { label: 'Formula sheet', Icon: Sigma },
  short_notes: { label: 'Short notes', Icon: NotebookPen },
  key_points: { label: 'Important points', Icon: AlertTriangle },
  practice: { label: 'Quick practice', Icon: HelpCircle },
  other: { label: 'Notes', Icon: FileText },
};

export function itemMeta(item: Pick<NotesItemCard, 'kind' | 'noteType' | 'pageCount' | 'bytes'>): { Icon: LucideIcon; text: string } {
  if (item.kind === 'pdf') {
    const pages = item.pageCount ? `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}` : null;
    return { Icon: FileText, text: ['PDF', pages, formatBytes(item.bytes)].filter(Boolean).join(' · ') };
  }
  if (item.kind === 'image') return { Icon: ImageIcon, text: ['Photo', formatBytes(item.bytes)].filter(Boolean).join(' · ') };
  const meta = NOTE_TYPE_META[item.noteType] ?? NOTE_TYPE_META.other;
  return { Icon: meta.Icon, text: meta.label };
}

export function folderTitle(folder: Pick<NotesFolderCard, 'name' | 'kind' | 'ncertNumber'>): string {
  return folder.kind === 'chapter' ? chapterLabel(folder.name, folder.ncertNumber) : folder.name;
}

const EXAM_LABELS: Record<NotesExam, string> = { jee: 'JEE', neet: 'NEET', boards: 'Boards' };

export function ExamChips({ exams, examOnly }: { exams: NotesExam[]; examOnly?: boolean }) {
  if (exams.length === 0 && !examOnly) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {examOnly && <Chip className="bg-warning/15 text-foreground">Exam only</Chip>}
      {exams.map((exam) => (
        <Chip key={exam}>{exams.length === 1 && exam === 'boards' ? 'Boards only' : EXAM_LABELS[exam]}</Chip>
      ))}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)}>
      {children}
    </span>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-3 sm:px-6">{children}</div>;
}

export function TopBar({
  backHref,
  backLabel = 'Back',
  title,
  actions,
}: {
  backHref?: string | null;
  backLabel?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 flex min-h-14 items-center gap-1 bg-background/95 px-2 py-1 backdrop-blur sm:-mx-6 sm:px-4 safe-top">
      {backHref ? (
        <Link href={backHref} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label={backLabel}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-tight">{title}</div>
      {actions && <div className="flex shrink-0 items-center">{actions}</div>}
    </div>
  );
}

export function Breadcrumbs({ crumbs, hrefFor }: { crumbs: NotesCrumb[]; hrefFor: (id: string) => string }) {
  if (crumbs.length <= 1) return null;
  return (
    <nav aria-label="Folders" className="-mx-1 mb-2 overflow-x-auto">
      <ol className="flex w-max items-center gap-1 px-1 text-sm text-muted-foreground">
        <li>
          <Link href="/notes" className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:text-foreground">
            Notes
          </Link>
        </li>
        {crumbs.slice(0, -1).map((crumb) => (
          <li key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
            <Link href={hrefFor(crumb.id)} className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:text-foreground">
              {crumb.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FolderRow({ folder, href }: { folder: NotesFolderCard; href: string }) {
  const count =
    folder.kind === 'class'
      ? `${folder.folderCount} subject${folder.folderCount === 1 ? '' : 's'}`
      : folder.kind === 'subject'
        ? `${folder.folderCount} chapter${folder.folderCount === 1 ? '' : 's'}`
        : folder.noteCount > 0
          ? `${folder.noteCount} note${folder.noteCount === 1 ? '' : 's'}`
          : folder.folderCount > 0
            ? `${folder.folderCount} folder${folder.folderCount === 1 ? '' : 's'}`
            : 'Coming soon';
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', subjectTone(folder.subject))}>
        <Folder className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{folderTitle(folder)}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{count}</span>
          {folder.kind === 'chapter' && <ExamChips exams={folder.exams} examOnly={folder.ncertNumber === null && folder.exams.some((e) => e !== 'boards')} />}
        </span>
      </span>
      {folder.locked && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Premium" />}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function ItemRow({
  item,
  href,
  subtitle,
  onToggleStar,
}: {
  item: NotesItemCard;
  href: string;
  subtitle?: ReactNode;
  onToggleStar?: (item: NotesItemCard) => void;
}) {
  const meta = itemMeta(item);
  return (
    <div className="flex min-h-16 items-center gap-1 rounded-2xl border border-border/60 bg-surface-1 pr-1 transition-colors hover:bg-surface-2">
      <Link href={href} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <meta.Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{item.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{subtitle ?? meta.text}</span>
        </span>
        {item.locked && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Premium" />}
      </Link>
      {onToggleStar && (
        <button
          type="button"
          onClick={() => onToggleStar(item)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-surface-3"
          aria-label={item.starred ? `Remove ${item.title} from starred` : `Star ${item.title}`}
          aria-pressed={item.starred}
        >
          <Star className={cn('h-5 w-5', item.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
        </button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-1" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-10 text-center">
      <p className="text-sm">{message}</p>
      <button type="button" onClick={onRetry} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
        <RotateCcw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-surface-2">
      {children}
    </Link>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </span>
  );
}

export function lockedCopy(subject: NotesSubject | null): string {
  return subject ? `This note is part of ${subjectLabel(subject)} Premium.` : 'This note is part of Premium.';
}
