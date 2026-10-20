'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, Lock, NotebookPen, Star, Target, Type } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { NOTES_REPORT_REASONS, type NotesItemPayload, type NotesReportReason } from '@/lib/notes/types';
import { NotesMarkdown } from '@/components/notes/NotesMarkdown';
import { PdfViewer } from '@/components/notes/PdfViewer';
import { ImageViewer } from '@/components/notes/ImageViewer';
import { useNotesLook } from '@/components/notes/use-notes-look';
import { NativePurchaseNotice, useIsNativeApp } from '@/components/native/NativePurchaseNotice';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { notesFileUrl, notesHref, notesSend, useNotesQuery } from './notes-client';
import { Breadcrumbs, EmptyState, ErrorState, LoadingRows, PageFrame, PrimaryLink, TopBar, lockedCopy } from './notes-ui';

const REASON_LABELS: Record<NotesReportReason, string> = {
  mistake: 'There is a mistake',
  unclear: "It's hard to understand",
  broken: "It doesn't open properly",
  other: 'Something else',
};

function ReportDialog({ itemId, open, onOpenChange }: { itemId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState<NotesReportReason>('mistake');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await notesSend(`library/items/${encodeURIComponent(itemId)}/report`, 'POST', { reason, message: message.trim() || null });
      toast.success("Thanks! We'll check this note.");
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as { message?: string }).message ?? 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>Tell us what&apos;s wrong with this note. The team reads every report.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="sr-only">What&apos;s wrong?</legend>
          {NOTES_REPORT_REASONS.map((value) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
              <input type="radio" name="notes-report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
              <span className="text-[15px]">{REASON_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Details (optional)</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
            rows={3}
            placeholder="For example: the formula for range has a sign error"
            className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-[15px] outline-none focus:border-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="h-12 rounded-full px-5 text-sm font-semibold hover:bg-surface-2">
            Cancel
          </button>
          <button type="button" onClick={send} disabled={busy} className="h-12 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LockedNote({ payload }: { payload: NotesItemPayload }) {
  const native = useIsNativeApp();
  const subject = payload.item.subject;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border bg-surface-1 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-display text-xl font-bold">{lockedCopy(subject)}</p>
      <p className="max-w-sm text-sm text-muted-foreground">Unlock it to read this note and every Premium note in the subject.</p>
      {native ? (
        <NativePurchaseNotice title="Get Premium on the Origin website" />
      ) : (
        <PrimaryLink href={subject ? `/premium?subject=${subject}` : '/premium'}>See Premium</PrimaryLink>
      )}
    </div>
  );
}

export function NotesReader({ itemId }: { itemId: string }) {
  const { data, error, loading, reload, setData } = useNotesQuery<NotesItemPayload>(`library/items/${encodeURIComponent(itemId)}`);
  const [look, setLook] = useNotesLook();
  const [reportOpen, setReportOpen] = useState(false);

  const folderHref = data ? notesHref({ folder: data.item.folderId }) : '/notes';
  const folderName = data?.breadcrumb[data.breadcrumb.length - 1]?.name;

  const toggleStar = async () => {
    if (!data) return;
    const next = !data.item.starred;
    setData({ ...data, item: { ...data.item, starred: next } });
    try {
      await notesSend(`library/items/${encodeURIComponent(itemId)}/star`, next ? 'POST' : 'DELETE');
      if (next) toast.success('Starred for quick revision');
    } catch {
      setData({ ...data, item: { ...data.item, starred: !next } });
      toast.error('Could not update starred notes. Try again.');
    }
  };

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref="/notes" title="" />
        <LoadingRows rows={6} />
      </PageFrame>
    );
  }
  if (error || !data) {
    return (
      <PageFrame>
        <TopBar backHref="/notes" backLabel="Back to Notes" title="Notes" />
        {error?.status === 404 ? (
          <EmptyState title="This note isn't available" body="It may have been moved or taken down for a fix." action={<PrimaryLink href="/notes">Back to Notes</PrimaryLink>} />
        ) : (
          <ErrorState message={error?.message ?? 'Could not load this note.'} onRetry={reload} />
        )}
      </PageFrame>
    );
  }

  const { item } = data;
  const fileHref = item.fileUrl;

  return (
    <PageFrame>
      <TopBar
        backHref={folderHref}
        backLabel={folderName ? `Back to ${folderName}` : 'Back'}
        title={item.title}
        actions={
          <>
            {item.kind === 'typed' && !item.locked && (
              <button
                type="button"
                onClick={() => setLook(look === 'notebook' ? 'clean' : 'notebook')}
                className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2"
                aria-label={look === 'notebook' ? 'Switch to clean style' : 'Switch to notebook style'}
                title={look === 'notebook' ? 'Clean style' : 'Notebook style'}
              >
                {look === 'notebook' ? <Type className="h-5 w-5" /> : <NotebookPen className="h-5 w-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={toggleStar}
              className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2"
              aria-label={item.starred ? 'Remove from starred' : 'Star this note'}
              aria-pressed={item.starred}
            >
              <Star className={cn('h-5 w-5', item.starred ? 'fill-amber-400 text-amber-400' : '')} />
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2"
              aria-label="Report a problem with this note"
            >
              <Flag className="h-5 w-5" />
            </button>
          </>
        }
      />
      <Breadcrumbs crumbs={data.breadcrumb.concat({ id: item.id, name: item.title })} hrefFor={(id) => notesHref({ folder: id })} />

      {item.locked ? (
        <LockedNote payload={data} />
      ) : item.kind === 'typed' ? (
        <NotesMarkdown markdown={item.bodyMd ?? ''} look={look} />
      ) : item.kind === 'pdf' && fileHref ? (
        <PdfViewer resolveUrl={() => notesFileUrl(item.id)} downloadHref={`${fileHref}?download=1`} />
      ) : item.kind === 'image' && fileHref ? (
        <ImageViewer src={fileHref} alt={item.title} />
      ) : (
        <EmptyState title="This file can't be shown here" />
      )}

      <nav aria-label="More notes" className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {data.prevId ? (
            <Link href={notesHref({ note: data.prevId })} className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface-2">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span />
          )}
          {data.nextId ? (
            <Link href={notesHref({ note: data.nextId })} className="flex min-h-12 items-center justify-center gap-1 rounded-full border border-border px-4 text-sm font-semibold hover:bg-surface-2">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </div>
        {data.practiseUrl && (
          <Link
            href={data.practiseUrl}
            className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 text-sm font-semibold text-primary hover:bg-primary/15"
          >
            <Target className="h-5 w-5" aria-hidden /> Practise this chapter
          </Link>
        )}
      </nav>

      <ReportDialog itemId={item.id} open={reportOpen} onOpenChange={setReportOpen} />
    </PageFrame>
  );
}
