'use client';

/**
 * My Notes (student) — open one of my files: typed notes (read and edit),
 * PDFs (pdf.js), photos (full screen with zoom), voice notes (speed 1×/1.5×/2×),
 * videos, and Word/PowerPoint (download only — phones can't preview them).
 * V1/NOTES_PLAN.md §3.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Download, Eye, Loader2, MoreVertical, NotebookPen, PenLine, Type } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/notes/rules';
import { typedNoteBytes } from '@/lib/notes/storage-rules';
import type { MyFilePayload, MyStorageSummary } from '@/lib/notes/my-types';
import { NotesMarkdown } from '@/components/notes/NotesMarkdown';
import { useNotesLook } from '@/components/notes/use-notes-look';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { myFileUrl, notesHref, notesSend, useNotesQuery } from '../notes-client';
import { EmptyState, ErrorState, LoadingRows, PageFrame, TopBar } from '../notes-ui';
import { ConfirmDialog, describeFile, MoveDialog, NameDialog } from './my-ui';
import { FileBody } from './FileBody';
import { ShareSheet } from './ShareSheet';

function TypedEditor({ file, onSaved, onCancel }: { file: MyFilePayload; onSaved: (next: MyFilePayload) => void; onCancel: () => void }) {
  const [body, setBody] = useState(file.bodyMd ?? '');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = typedNoteBytes(body);
  const tooBig = size > 200 * 1024;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await notesSend<MyFilePayload>(`me/files/${encodeURIComponent(file.id)}`, 'PUT', { bodyMd: body, baseVersion: file.version });
      toast.success('Saved');
      onSaved(next);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="tablist" aria-label="Editor">
        <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)} className={cn('inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold', !preview ? 'bg-primary text-primary-foreground' : 'border border-border')}>
          <PenLine className="h-4 w-4" aria-hidden /> Write
        </button>
        <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)} className={cn('inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold', preview ? 'bg-primary text-primary-foreground' : 'border border-border')}>
          <Eye className="h-4 w-4" aria-hidden /> Preview
        </button>
        <span className={cn('ml-auto text-sm', tooBig ? 'text-destructive' : 'text-muted-foreground')}>{formatBytes(size) || '0 B'} of 200 KB</span>
      </div>
      {preview ? (
        body.trim() ? <NotesMarkdown markdown={body} look="clean" remoteImages={false} /> : <p className="py-8 text-center text-sm text-muted-foreground">Nothing written yet.</p>
      ) : (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Note text"
          placeholder={'Write your note here.\n\nFormulas work like $v = u + at$, and **bold** for important points.'}
          className="min-h-[55vh] w-full rounded-2xl border border-border bg-surface-1 p-4 font-mono text-[15px] leading-relaxed outline-none focus:border-primary"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border text-sm font-semibold hover:bg-surface-2">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy || tooBig} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save
        </button>
      </div>
    </div>
  );
}

export function MyFileView({ fileId, sharingEnabled = false }: { fileId: string; sharingEnabled?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, loading, reload, setData } = useNotesQuery<MyFilePayload>(`me/files/${encodeURIComponent(fileId)}`);
  const [look, setLook] = useNotesLook();
  const { data: storage } = useNotesQuery<MyStorageSummary>(sharingEnabled ? 'me/storage' : null);
  const canShare = Boolean(storage?.sharingOn && !storage.sharingBlocked);
  const [editing, setEditingState] = useState(params.get('edit') === '1');
  // Leaving the editor also drops `edit=1` from the URL, so a reload shows the note.
  const setEditing = (next: boolean) => {
    setEditingState(next);
    if (!next && params.get('edit') === '1') router.replace(notesHref({ tab: 'mine', myFile: fileId }));
  };
  const [dialog, setDialog] = useState<null | 'rename' | 'move' | 'delete' | 'share'>(null);

  const folderHref = notesHref({ tab: 'mine', myFolder: data?.folderId ?? null });
  const fileHref = `/api/notes/me/files/${encodeURIComponent(fileId)}/file`;

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref={notesHref({ tab: 'mine' })} title="" />
        <LoadingRows rows={6} />
      </PageFrame>
    );
  }
  if (error || !data) {
    return (
      <PageFrame>
        <TopBar backHref={notesHref({ tab: 'mine' })} backLabel="Back to My Notes" title="My Notes" />
        {error?.status === 404 ? (
          <EmptyState title="This file isn't here" body="It may have been moved or deleted. Check the Bin." />
        ) : (
          <ErrorState message={error?.message ?? 'Could not open this file.'} onRetry={reload} />
        )}
      </PageFrame>
    );
  }

  const menuItem = 'min-h-11 text-[15px]';
  return (
    <PageFrame>
      <TopBar
        backHref={folderHref}
        backLabel="Back to the folder"
        title={data.title}
        actions={
          <>
            {data.kind === 'typed' && !editing && (
              <>
                <button type="button" onClick={() => setLook(look === 'notebook' ? 'clean' : 'notebook')} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label={look === 'notebook' ? 'Switch to clean style' : 'Switch to notebook style'}>
                  {look === 'notebook' ? <Type className="h-5 w-5" /> : <NotebookPen className="h-5 w-5" />}
                </button>
                <button type="button" onClick={() => setEditing(true)} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Edit this note">
                  <PenLine className="h-5 w-5" />
                </button>
              </>
            )}
            {data.kind !== 'typed' && (
              <a href={`${fileHref}?download=1`} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Download">
                <Download className="h-5 w-5" />
              </a>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="More">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {canShare && <DropdownMenuItem className={menuItem} onSelect={() => setDialog('share')}>Share with friends</DropdownMenuItem>}
                <DropdownMenuItem className={menuItem} onSelect={() => setDialog('rename')}>Rename</DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onSelect={() => setDialog('move')}>Move</DropdownMenuItem>
                <DropdownMenuItem className={cn(menuItem, 'text-destructive focus:text-destructive')} onSelect={() => setDialog('delete')}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <p className="mb-3 text-sm text-muted-foreground">{['My Notes', ...data.breadcrumb.map((crumb) => crumb.name)].join(' › ')} · {describeFile(data)}</p>

      {data.kind === 'typed' ? (
        editing ? (
          <TypedEditor
            file={data}
            onSaved={(next) => {
              setData(next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : data.bodyMd?.trim() ? (
          <NotesMarkdown markdown={data.bodyMd} look={look} remoteImages={false} />
        ) : (
          <EmptyState title="This note is empty" action={<button type="button" onClick={() => setEditing(true)} className="inline-flex h-12 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Start writing</button>} />
        )
      ) : (
        <FileBody file={data} fileHref={fileHref} resolvePdfUrl={() => myFileUrl(data.id)} />
      )}

      {dialog === 'share' && (
        <ShareSheet open onOpenChange={(open) => !open && setDialog(null)} target={{ type: 'file', id: data.id, title: data.title }} />
      )}
      {dialog === 'rename' && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Rename"
          label="New name"
          initial={data.title}
          submitLabel="Save"
          onSubmit={async (title) => {
            setData(await notesSend<MyFilePayload>(`me/files/${encodeURIComponent(data.id)}`, 'PUT', { title }));
          }}
        />
      )}
      {dialog === 'move' && (
        <MoveDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          itemName={data.title}
          currentFolderId={data.folderId}
          onMove={async (folderId) => {
            setData(await notesSend<MyFilePayload>(`me/files/${encodeURIComponent(data.id)}`, 'PUT', { folderId }));
            toast.success('Moved');
          }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Delete “${data.title}”?`}
          body="It goes to the Bin, where you can restore it."
          confirmLabel="Move to Bin"
          danger
          onConfirm={async () => {
            await notesSend(`me/files/${encodeURIComponent(data.id)}`, 'DELETE');
            toast.success('Moved to the Bin');
            router.push(folderHref);
          }}
        />
      )}
    </PageFrame>
  );
}
