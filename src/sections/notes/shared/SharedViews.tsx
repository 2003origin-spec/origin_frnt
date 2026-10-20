'use client';

/**
 * Origin Notes — notes friends shared with me (V1/NOTES_PLAN.md §9).
 * Read-only: open, play, download, and report. Grouped by friend.
 *
 *   ?tab=shared                         everything shared with me
 *   ?tab=shared&share=<id>[&sf=<f>]     a shared folder (or a folder inside it)
 *   ?tab=shared&share=<id>&sfile=<f>    one shared file
 */

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Download, Flag, Folder, NotebookPen, Type, Users } from 'lucide-react';
import { toast } from 'sonner';

import { SHARED_REPORT_REASONS, type SharedReportReason } from '@/lib/notes/types';
import type { SharedFilePayload, SharedFolderPayload, SharedWithMePayload } from '@/lib/notes/my-types';
import { NotesMarkdown } from '@/components/notes/NotesMarkdown';
import { useNotesLook } from '@/components/notes/use-notes-look';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { notesHref, notesSend, sharedFileUrl, useNotesQuery } from '../notes-client';
import { EmptyState, ErrorState, LoadingRows, PageFrame, PrimaryLink, TopBar } from '../notes-ui';
import { FileBody } from '../my/FileBody';
import { describeFile, formatDayIST, MyFileRow, MyFolderRow } from '../my/my-ui';
import { FriendAvatar } from '../my/ShareSheet';

const GONE_TITLE = "You can't open this any more";
const GONE_BODY = 'Your friend may have stopped sharing it or deleted it, or you no longer follow each other.';

const REASON_LABELS: Record<SharedReportReason, string> = {
  inappropriate: 'Not appropriate for students',
  copyright: "Copied from a book or paid course (someone else's work)",
  spam: 'Spam or advertising',
  other: 'Something else',
};

function ReportSharedDialog({ shareId, fileId, open, onOpenChange }: { shareId: string; fileId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState<SharedReportReason>('inappropriate');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await notesSend(`shared/${encodeURIComponent(shareId)}/report`, 'POST', { fileId, reason, message: message.trim() || null });
      toast.success('Thanks. Our team will look at it.');
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
          <DialogTitle>Report this file</DialogTitle>
          <DialogDescription>Only the Origin team sees reports. Your friend isn&apos;t told who reported it.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1">
          <legend className="sr-only">What&apos;s wrong?</legend>
          {SHARED_REPORT_REASONS.map((value) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
              <input type="radio" name="notes-shared-report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
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

function SharedBy({ name, avatar, extra }: { name: string; avatar: string | null; extra?: string }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
      <FriendAvatar name={name} avatar={avatar} size="h-7 w-7" />
      <span className="min-w-0 truncate">
        Shared by <span className="font-semibold text-foreground">{name}</span>
        {extra ? ` · ${extra}` : ''}
      </span>
    </p>
  );
}

export function SharedWithMeView() {
  const { data, error, loading, reload } = useNotesQuery<SharedWithMePayload>('shared');
  return (
    <PageFrame>
      <TopBar backHref="/notes" backLabel="Back to Notes" title="Shared with me" />
      {loading && !data ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data || data.groups.length === 0 ? (
        <EmptyState
          title="Nothing shared with you yet"
          body="When a friend shares notes with you, they show up here. Friends are students you follow who follow you back."
          action={<PrimaryLink href="/social">Find friends</PrimaryLink>}
        />
      ) : (
        <div className="space-y-6">
          {data.groups.map((group) => (
            <section key={group.owner.id} aria-label={`From ${group.owner.name}`}>
              <h2 className="mb-2 flex items-center gap-2">
                <FriendAvatar name={group.owner.name} avatar={group.owner.avatar} size="h-8 w-8" />
                <span className="min-w-0 truncate text-[15px] font-semibold">{group.owner.name}</span>
                {group.owner.username && <span className="truncate text-sm text-muted-foreground">@{group.owner.username}</span>}
              </h2>
              <div className="space-y-2">
                {group.entries.map((entry) =>
                  entry.file ? (
                    <MyFileRow
                      key={entry.shareId}
                      file={entry.file}
                      href={notesHref({ tab: 'shared', share: entry.shareId, sharedFile: entry.file.id })}
                      subtitle={`${describeFile(entry.file)} · ${formatDayIST(entry.sharedAt)}`}
                    />
                  ) : (
                    <Link
                      key={entry.shareId}
                      href={notesHref({ tab: 'shared', share: entry.shareId })}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 transition-colors hover:bg-surface-2"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Folder className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{entry.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">Folder · {formatDayIST(entry.sharedAt)}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export function SharedFolderView({ shareId, folderId }: { shareId: string; folderId: string | null }) {
  const path = `shared/${encodeURIComponent(shareId)}${folderId ? `?folder=${encodeURIComponent(folderId)}` : ''}`;
  const { data, error, loading, reload } = useNotesQuery<SharedFolderPayload>(path);
  const listHref = notesHref({ tab: 'shared' });

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref={listHref} title="" />
        <LoadingRows />
      </PageFrame>
    );
  }
  if (error || !data) {
    return (
      <PageFrame>
        <TopBar backHref={listHref} backLabel="Back to Shared with me" title="Shared with me" />
        {error?.status === 404 ? <EmptyState title={GONE_TITLE} body={GONE_BODY} /> : <ErrorState message={error?.message ?? 'Could not open this folder.'} onRetry={reload} />}
      </PageFrame>
    );
  }

  const parent = data.breadcrumb.length > 1 ? data.breadcrumb[data.breadcrumb.length - 2] : null;
  const backHref = parent ? notesHref({ tab: 'shared', share: shareId, sharedFolder: parent.id }) : listHref;
  const empty = data.folders.length === 0 && data.files.length === 0;
  return (
    <PageFrame>
      <TopBar backHref={backHref} backLabel="Back" title={data.folder.name} />
      {data.breadcrumb.length > 1 && (
        <nav aria-label="Folders" className="-mx-1 mb-1 overflow-x-auto">
          <ol className="flex w-max items-center gap-1 px-1 text-sm text-muted-foreground">
            {data.breadcrumb.slice(0, -1).map((crumb, index) => (
              <li key={crumb.id} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden>›</span>}
                <Link href={notesHref({ tab: 'shared', share: shareId, sharedFolder: crumb.id })} className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:text-foreground">
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <SharedBy name={data.owner.name} avatar={data.owner.avatar} extra="read only" />
      {empty ? (
        <EmptyState title="This folder is empty" body="Files your friend adds here will show up for you too." />
      ) : (
        <div className="space-y-2">
          {data.folders.map((folder) => (
            <MyFolderRow key={folder.id} folder={folder} href={notesHref({ tab: 'shared', share: shareId, sharedFolder: folder.id })} actions={[]} />
          ))}
          {data.files.map((file) => (
            <MyFileRow key={file.id} file={file} href={notesHref({ tab: 'shared', share: shareId, sharedFile: file.id })} />
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export function SharedFileView({ shareId, fileId }: { shareId: string; fileId: string }) {
  const { data, error, loading, reload } = useNotesQuery<SharedFilePayload>(`shared/${encodeURIComponent(shareId)}/files/${encodeURIComponent(fileId)}`);
  const [look, setLook] = useNotesLook();
  const [reportOpen, setReportOpen] = useState(false);
  const listHref = notesHref({ tab: 'shared' });
  const fileHref = `/api/notes/shared/${encodeURIComponent(shareId)}/files/${encodeURIComponent(fileId)}/file`;

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref={listHref} title="" />
        <LoadingRows rows={6} />
      </PageFrame>
    );
  }
  if (error || !data) {
    return (
      <PageFrame>
        <TopBar backHref={listHref} backLabel="Back to Shared with me" title="Shared with me" />
        {error?.status === 404 ? <EmptyState title={GONE_TITLE} body={GONE_BODY} /> : <ErrorState message={error?.message ?? 'Could not open this file.'} onRetry={reload} />}
      </PageFrame>
    );
  }

  // A file inside a shared folder goes back to its folder; a shared file goes back to the list.
  const backHref = data.breadcrumb.length > 0 ? notesHref({ tab: 'shared', share: shareId, sharedFolder: data.folderId }) : listHref;
  const iconButton = 'flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2';
  return (
    <PageFrame>
      <TopBar
        backHref={backHref}
        backLabel="Back"
        title={data.title}
        actions={
          <>
            {data.kind === 'typed' ? (
              <button type="button" onClick={() => setLook(look === 'notebook' ? 'clean' : 'notebook')} className={iconButton} aria-label={look === 'notebook' ? 'Switch to clean style' : 'Switch to notebook style'}>
                {look === 'notebook' ? <Type className="h-5 w-5" /> : <NotebookPen className="h-5 w-5" />}
              </button>
            ) : (
              <a href={`${fileHref}?download=1`} className={iconButton} aria-label="Download">
                <Download className="h-5 w-5" />
              </a>
            )}
            <button type="button" onClick={() => setReportOpen(true)} className={iconButton} aria-label="Report this file">
              <Flag className="h-5 w-5" />
            </button>
          </>
        }
      />
      <SharedBy name={data.owner.name} avatar={data.owner.avatar} extra={describeFile(data)} />
      {data.kind === 'typed' ? (
        data.bodyMd?.trim() ? (
          <NotesMarkdown markdown={data.bodyMd} look={look} remoteImages={false} />
        ) : (
          <EmptyState title="This note is empty" />
        )
      ) : (
        <FileBody file={data} fileHref={fileHref} resolvePdfUrl={() => sharedFileUrl(shareId, data.id)} />
      )}
      <ReportSharedDialog shareId={shareId} fileId={data.id} open={reportOpen} onOpenChange={setReportOpen} />
    </PageFrame>
  );
}

/** The "Shared with me" tile on the Notes home. */
export function SharedWithMeCard() {
  return (
    <Link
      href={notesHref({ tab: 'shared' })}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 hover:bg-surface-2"
    >
      <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">Shared with me</span>
        <span className="block truncate text-sm text-muted-foreground">From friends</span>
      </span>
    </Link>
  );
}
