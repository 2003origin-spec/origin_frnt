'use client';

/**
 * My Notes (student) — shared pieces: storage bar, file rows, and the name,
 * move and confirm dialogs. Every tap target is at least 48px tall.
 */

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { AudioLines, ChevronRight, FileText, Folder, FolderOpen, Image as ImageIcon, Loader2, MoreVertical, NotebookPen, Presentation, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/notes/rules';
import { STORAGE_FULL_MESSAGE, type MyFileKind } from '@/lib/notes/storage-rules';
import type { MyFileCard, MyFolderCard, MyFolderPayload, MyStorageSummary } from '@/lib/notes/my-types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { notesHref, useNotesQuery } from '../notes-client';

const KIND_META: Record<MyFileKind, { Icon: LucideIcon; label: string; tone: string }> = {
  typed: { Icon: NotebookPen, label: 'Typed note', tone: 'bg-primary/12 text-primary' },
  pdf: { Icon: FileText, label: 'PDF', tone: 'bg-rose-500/12 text-rose-600 dark:text-rose-300' },
  image: { Icon: ImageIcon, label: 'Photo', tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-300' },
  office: { Icon: Presentation, label: 'Office file', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  audio: { Icon: AudioLines, label: 'Voice note', tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-300' },
  video: { Icon: Video, label: 'Video', tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
};

export function kindMeta(kind: MyFileKind) {
  return KIND_META[kind] ?? KIND_META.pdf;
}

/** dd/mm/yyyy in IST (the app-wide date rule). */
export function formatDayIST(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function describeFile(file: MyFileCard): string {
  const meta = kindMeta(file.kind);
  const label = file.kind === 'office' && file.mime?.includes('presentation') ? 'PowerPoint' : file.kind === 'office' ? 'Word' : meta.label;
  const pages = file.pageCount ? `${file.pageCount} page${file.pageCount === 1 ? '' : 's'}` : null;
  return [label, pages, formatDuration(file.durationS), file.bytes > 0 ? formatBytes(file.bytes) : null].filter(Boolean).join(' · ');
}

export function StorageBar({ storage, compact = false }: { storage: MyStorageSummary; compact?: boolean }) {
  const tone = storage.level === 'full' ? 'bg-destructive' : storage.level === 'warn' ? 'bg-amber-500' : 'bg-primary';
  return (
    <section aria-label="Storage" className={cn('rounded-2xl border border-border/60 bg-surface-1', compact ? 'px-3 py-2.5' : 'p-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold">
          {formatBytes(storage.usedBytes) || '0 B'} of {formatBytes(storage.limitBytes) || '0 B'} used
        </p>
        <p className="text-sm text-muted-foreground">{storage.percent}%</p>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={storage.percent}
      >
        <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${Math.max(storage.percent, storage.usedBytes > 0 ? 2 : 0)}%` }} />
      </div>
      {!compact && storage.level === 'full' && <p className="mt-2 text-sm font-medium text-destructive">{STORAGE_FULL_MESSAGE}</p>}
      {!compact && storage.level === 'warn' && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">You&apos;ve used most of your space. Clear out old files or empty the Bin.</p>}
      {!compact && storage.binBytes > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {formatBytes(storage.binBytes)} is in the{' '}
          <Link href={notesHref({ tab: 'bin' })} className="font-semibold text-primary underline underline-offset-2">
            Bin
          </Link>{' '}
          and still counts until it is emptied.
        </p>
      )}
      {!compact && storage.uploadsBlocked && <p className="mt-2 text-sm font-medium text-destructive">Uploads are turned off for your account.</p>}
    </section>
  );
}

export type RowAction = { label: string; onSelect: () => void; danger?: boolean };

function RowMenu({ title, actions }: { title: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-surface-3" aria-label={`More for ${title}`}>
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={action.onSelect}
            className={cn('min-h-11 text-[15px]', action.danger && 'text-destructive focus:text-destructive')}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MyFolderRow({ folder, href, actions }: { folder: MyFolderCard; href: string; actions: RowAction[] }) {
  const count = [
    folder.folderCount ? `${folder.folderCount} folder${folder.folderCount === 1 ? '' : 's'}` : null,
    `${folder.fileCount} file${folder.fileCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex min-h-16 items-center gap-1 rounded-2xl border border-border/60 bg-surface-1 pr-1 transition-colors hover:bg-surface-2">
      <Link href={href} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Folder className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{folder.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{count}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {actions.length > 0 && <RowMenu title={folder.name} actions={actions} />}
    </div>
  );
}

export function MyFileRow({ file, href, subtitle, actions }: { file: MyFileCard; href: string; subtitle?: ReactNode; actions?: RowAction[] }) {
  const meta = kindMeta(file.kind);
  return (
    <div className="flex min-h-16 items-center gap-1 rounded-2xl border border-border/60 bg-surface-1 pr-1 transition-colors hover:bg-surface-2">
      <Link href={href} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
          <meta.Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{file.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{subtitle ?? describeFile(file)}</span>
        </span>
      </Link>
      {actions && actions.length > 0 && <RowMenu title={file.title} actions={actions} />}
    </div>
  );
}

const buttonBase = 'inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60';

export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  initial = '',
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      setError('Type a name first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
      onOpenChange(false);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{label}</DialogDescription>
          </DialogHeader>
          <label className="mt-4 block text-sm font-medium">
            {label}
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={160}
              className="mt-1 h-12 w-full rounded-xl border border-border bg-surface-1 px-3 text-[15px] outline-none focus:border-primary"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="mt-5 gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={cn(buttonBase, 'border border-border hover:bg-surface-2')}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={cn(buttonBase, 'bg-primary text-primary-foreground')}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="mt-2 gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={cn(buttonBase, 'border border-border hover:bg-surface-2')}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={cn(buttonBase, danger ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground')}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mount these dialogs only while they are open (`{open && <MoveDialog … />}`),
 * so each opening starts fresh from its props.
 *
 * Pick a destination folder by browsing My Notes. `blockedId` (the folder
 * being moved) can't be opened or picked, so a folder never lands inside itself.
 */
export function MoveDialog({
  open,
  onOpenChange,
  itemName,
  currentFolderId,
  blockedId,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  currentFolderId: string | null;
  blockedId?: string | null;
  onMove: (folderId: string | null) => Promise<void>;
}) {
  const [at, setAt] = useState<string | null>(currentFolderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useNotesQuery<MyFolderPayload>(open ? (at ? `me/folders/${encodeURIComponent(at)}` : 'me/folders') : null);

  const move = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMove(at);
      onOpenChange(false);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not move it. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const crumbs = data?.breadcrumb ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move “{itemName}”</DialogTitle>
          <DialogDescription>Open the folder you want, then tap “Move here”.</DialogDescription>
        </DialogHeader>
        <nav aria-label="Folders" className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => setAt(null)} className="min-h-11 rounded-lg px-2 font-semibold hover:bg-surface-2">
            My Notes
          </button>
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
              <button type="button" onClick={() => setAt(crumb.id)} className="min-h-11 rounded-lg px-2 hover:bg-surface-2">
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && !data ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (data?.folders ?? []).filter((f) => f.id !== blockedId).length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No folders here.</p>
          ) : (
            (data?.folders ?? [])
              .filter((f) => f.id !== blockedId)
              .map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setAt(folder.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                >
                  <FolderOpen className="h-5 w-5 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{folder.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button>
              ))
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={cn(buttonBase, 'border border-border hover:bg-surface-2')}>
            Cancel
          </button>
          <button type="button" onClick={move} disabled={busy || at === currentFolderId} className={cn(buttonBase, 'bg-primary text-primary-foreground')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Move here
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
