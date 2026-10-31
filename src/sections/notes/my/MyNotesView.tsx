'use client';

/**
 * My Notes (student) — one folder's contents, plus the actions to fill it:
 * upload files, take a photo, record a voice note, write a typed note, make a
 * folder. Rename, move and delete (to the Bin) from each row's menu.
 * V1/NOTES_PLAN.md §3 "My Notes".
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, FolderPlus, Loader2, Mic, NotebookPen, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { NOTES_FILE_TYPES } from '@/lib/notes/file-types';
import type { MyFileCard, MyFolderCard, MyFolderPayload, MySearchHit } from '@/lib/notes/my-types';

import { notesHref, notesSend, useNotesQuery } from '../notes-client';
import { EmptyState, ErrorState, LoadingRows, PageFrame, TopBar } from '../notes-ui';
import { ConfirmDialog, MoveDialog, MyFileRow, MyFolderRow, NameDialog, StorageBar, type RowAction } from './my-ui';
import { useMyUploads, type UploadJob } from './use-my-uploads';
import { VoiceRecorder } from './VoiceRecorder';
import { ShareSheet } from './ShareSheet';

type Target = { type: 'folder'; folder: MyFolderCard } | { type: 'file'; file: MyFileCard };
type DialogState =
  | { kind: 'new-folder' }
  | { kind: 'new-note' }
  | { kind: 'rename'; target: Target }
  | { kind: 'move'; target: Target }
  | { kind: 'delete'; target: Target }
  | { kind: 'share'; target: Target }
  | { kind: 'voice' }
  | null;

function acceptList(kinds: readonly string[]): string {
  return NOTES_FILE_TYPES.filter((type) => kinds.includes(type.kind))
    .flatMap((type) => [type.mime, `.${type.ext}`, ...(type.aliases ?? []).map((alias) => `.${alias}`)])
    .join(',');
}

function UploadList({ jobs, onDismiss }: { jobs: UploadJob[]; onDismiss: (key: string) => void }) {
  if (jobs.length === 0) return null;
  const words: Record<UploadJob['status'], string> = {
    waiting: 'Waiting…',
    preparing: 'Getting ready…',
    uploading: 'Uploading',
    checking: 'Checking the file…',
    done: 'Saved',
    failed: 'Failed',
  };
  return (
    <section aria-label="Uploads" className="space-y-2">
      {jobs.map((job) => (
        <div key={job.key} className="rounded-2xl border border-border/60 bg-surface-1 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {job.status === 'done' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            ) : job.status === 'failed' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
            ) : (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{job.name}</span>
            <span className="shrink-0 text-sm text-muted-foreground" aria-live="polite">
              {job.status === 'uploading' ? `${Math.round(job.progress * 100)}%` : words[job.status]}
            </span>
            {(job.status === 'failed' || job.status === 'done') && (
              <button type="button" onClick={() => onDismiss(job.key)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Hide ${job.name}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {job.status === 'uploading' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={`Uploading ${job.name}`} aria-valuenow={Math.round(job.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </div>
          )}
          {job.error && <p className="mt-1 text-sm text-destructive">{job.error}</p>}
        </div>
      ))}
    </section>
  );
}

function MySearchBox({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (q.length >= 2) router.push(notesHref({ tab: 'mine', myQ: q }));
  };
  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search My Notes by name"
        aria-label="Search My Notes"
        enterKeyHint="search"
        className="h-12 w-full rounded-full border border-border bg-surface-1 pl-12 pr-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary"
      />
    </form>
  );
}

export function MySearchView({ q }: { q: string }) {
  const { data, error, loading, reload } = useNotesQuery<{ hits: MySearchHit[] }>(`me/search?q=${encodeURIComponent(q)}`);
  return (
    <PageFrame>
      <TopBar backHref={notesHref({ tab: 'mine' })} backLabel="Back to My Notes" title="Search My Notes" />
      <MySearchBox key={q} initial={q} />
      <div className="mt-4 space-y-2">
        {loading && !data ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data && data.hits.length === 0 ? (
          <EmptyState title={`Nothing named "${q}"`} body="Search looks at file and folder names." />
        ) : (
          (data?.hits ?? []).map((hit) =>
            hit.type === 'folder' ? (
              <MyFolderRow
                key={hit.id}
                folder={{ id: hit.id, name: hit.name, folderCount: 0, fileCount: 0, updatedAt: '' }}
                href={notesHref({ tab: 'mine', myFolder: hit.id })}
                actions={[]}
              />
            ) : (
              <MyFileRow
                key={hit.file.id}
                file={hit.file}
                href={notesHref({ tab: 'mine', myFile: hit.file.id })}
                subtitle={['My Notes', ...hit.breadcrumb.map((c) => c.name)].join(' › ')}
              />
            ),
          )
        )}
      </div>
    </PageFrame>
  );
}

export function MyNotesView({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const path = folderId ? `me/folders/${encodeURIComponent(folderId)}` : 'me/folders';
  const { data, error, loading, reload } = useNotesQuery<MyFolderPayload>(path);
  const [dialog, setDialog] = useState<DialogState>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploads = useMyUploads(() => reload());

  const close = () => setDialog(null);
  const storage = data?.storage;
  const canAdd = Boolean(storage && storage.uploadsEnabled && !storage.uploadsBlocked);
  const accept = storage ? acceptList(storage.allowedKinds) : '';

  const pickFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    uploads.start(files.map((file) => ({ file })), folderId);
  };

  const parentHref = data?.folder?.parentId ? notesHref({ tab: 'mine', myFolder: data.folder.parentId }) : data?.folder ? notesHref({ tab: 'mine' }) : '/notes';

  const canShare = Boolean(storage?.sharingOn && !storage.sharingBlocked);
  const actionsFor = (target: Target): RowAction[] => [
    ...(canShare ? [{ label: 'Share with friends', onSelect: () => setDialog({ kind: 'share', target }) }] : []),
    { label: 'Rename', onSelect: () => setDialog({ kind: 'rename', target }) },
    { label: 'Move', onSelect: () => setDialog({ kind: 'move', target }) },
    { label: 'Delete', onSelect: () => setDialog({ kind: 'delete', target }), danger: true },
  ];

  const targetName = (target: Target) => (target.type === 'folder' ? target.folder.name : target.file.title);
  const targetPath = (target: Target) =>
    target.type === 'folder' ? `me/folders/${encodeURIComponent(target.folder.id)}` : `me/files/${encodeURIComponent(target.file.id)}`;

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref="/notes" title="My Notes" />
        <LoadingRows rows={5} />
      </PageFrame>
    );
  }
  if (error || !data || !storage) {
    return (
      <PageFrame>
        <TopBar backHref={notesHref({ tab: 'mine' })} backLabel="Back to My Notes" title="My Notes" />
        {error?.status === 404 ? (
          <EmptyState title="This folder isn't here" body="It may have been moved or deleted." />
        ) : (
          <ErrorState message={error?.message ?? 'Could not load My Notes.'} onRetry={reload} />
        )}
      </PageFrame>
    );
  }

  const empty = data.folders.length === 0 && data.files.length === 0;
  const actionButton = 'inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-surface-1 px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50';

  return (
    <PageFrame>
      <TopBar
        backHref={parentHref}
        backLabel="Back"
        title={data.folder?.name ?? 'My Notes'}
        actions={
          <Link href={notesHref({ tab: 'bin' })} className="relative flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Bin${storage.binCount ? `, ${storage.binCount} items` : ''}`}>
            <Trash2 className="h-5 w-5" />
            {storage.binCount > 0 && (
              <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-surface-3 px-1 text-center text-[11px] font-bold leading-5">{storage.binCount}</span>
            )}
          </Link>
        }
      />

      {data.breadcrumb.length > 0 && (
        <nav aria-label="Folders" className="-mx-1 mb-2 overflow-x-auto">
          <ol className="flex w-max items-center gap-1 px-1 text-sm text-muted-foreground">
            <li>
              <Link href={notesHref({ tab: 'mine' })} className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:text-foreground">
                My Notes
              </Link>
            </li>
            {data.breadcrumb.slice(0, -1).map((crumb) => (
              <li key={crumb.id} className="flex items-center gap-1">
                <span aria-hidden>›</span>
                <Link href={notesHref({ tab: 'mine', myFolder: crumb.id })} className="inline-flex min-h-11 items-center rounded-lg px-1.5 hover:text-foreground">
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="space-y-4">
        {!folderId && <StorageBar storage={storage} />}
        {!folderId && <MySearchBox />}

        {canAdd ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="toolbar" aria-label="Add to this folder">
            <button type="button" className={cn(actionButton, 'border-primary/50 bg-primary text-primary-foreground hover:bg-primary/90')} onClick={() => filesInput.current?.click()}>
              <Upload className="h-5 w-5" aria-hidden /> Upload
            </button>
            {storage.allowedKinds.includes('image') && (
              <button type="button" className={actionButton} onClick={() => cameraInput.current?.click()}>
                <Camera className="h-5 w-5" aria-hidden /> Photo
              </button>
            )}
            {storage.allowedKinds.includes('audio') && (
              <button type="button" className={actionButton} onClick={() => setDialog({ kind: 'voice' })}>
                <Mic className="h-5 w-5" aria-hidden /> Voice
              </button>
            )}
            <button type="button" className={actionButton} onClick={() => setDialog({ kind: 'new-note' })}>
              <NotebookPen className="h-5 w-5" aria-hidden /> Note
            </button>
            <button type="button" className={actionButton} onClick={() => setDialog({ kind: 'new-folder' })}>
              <FolderPlus className="h-5 w-5" aria-hidden /> Folder
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionButton} onClick={() => setDialog({ kind: 'new-folder' })}>
              <FolderPlus className="h-5 w-5" aria-hidden /> Folder
            </button>
            <p className="w-full text-sm text-muted-foreground">
              {storage.uploadsBlocked ? 'Uploads are turned off for your account.' : 'Uploads are paused for a while. You can still open and organise your notes.'}
            </p>
          </div>
        )}

        <input ref={filesInput} type="file" multiple accept={accept} className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { pickFiles(event.target.files); event.target.value = ''; }} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { pickFiles(event.target.files); event.target.value = ''; }} />

        <UploadList jobs={uploads.jobs} onDismiss={uploads.dismiss} />

        {empty ? (
          <EmptyState
            title={folderId ? 'This folder is empty' : 'Your notes live here'}
            body={folderId ? 'Upload a file, take a photo, record a voice note or write a note.' : 'Upload PDFs, photos of your handwritten notes, voice notes, videos or Word files, or write a quick note. Only you can see them.'}
          />
        ) : (
          <div className="space-y-2">
            {data.folders.map((folder) => (
              <MyFolderRow key={folder.id} folder={folder} href={notesHref({ tab: 'mine', myFolder: folder.id })} actions={actionsFor({ type: 'folder', folder })} />
            ))}
            {data.files.map((file) => (
              <MyFileRow key={file.id} file={file} href={notesHref({ tab: 'mine', myFile: file.id })} actions={actionsFor({ type: 'file', file })} />
            ))}
          </div>
        )}
      </div>

      {dialog?.kind === 'new-folder' && (
        <NameDialog
          open
          onOpenChange={(open) => !open && close()}
          title="New folder"
          label="Folder name"
          submitLabel="Create"
          onSubmit={async (name) => {
            await notesSend('me/folders', 'POST', { parentId: folderId, name });
            reload();
          }}
        />
      )}
      {dialog?.kind === 'new-note' && (
        <NameDialog
          open
          onOpenChange={(open) => !open && close()}
          title="New typed note"
          label="Title"
          submitLabel="Start writing"
          onSubmit={async (title) => {
            const created = await notesSend<MyFileCard>('me/notes', 'POST', { folderId, title, bodyMd: '' });
            router.push(`${notesHref({ tab: 'mine', myFile: created.id })}&edit=1`);
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          open
          onOpenChange={(open) => !open && close()}
          title={dialog.target.type === 'folder' ? 'Rename folder' : 'Rename'}
          label="New name"
          initial={targetName(dialog.target)}
          submitLabel="Save"
          onSubmit={async (name) => {
            await notesSend(targetPath(dialog.target), 'PUT', dialog.target.type === 'folder' ? { name } : { title: name });
            reload();
          }}
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog
          open
          onOpenChange={(open) => !open && close()}
          itemName={targetName(dialog.target)}
          currentFolderId={folderId}
          blockedId={dialog.target.type === 'folder' ? dialog.target.folder.id : null}
          onMove={async (to) => {
            await notesSend(targetPath(dialog.target), 'PUT', dialog.target.type === 'folder' ? { parentId: to } : { folderId: to });
            toast.success('Moved');
            reload();
          }}
        />
      )}
      {dialog?.kind === 'share' && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && close()}
          target={
            dialog.target.type === 'folder'
              ? { type: 'folder', id: dialog.target.folder.id, title: dialog.target.folder.name }
              : { type: 'file', id: dialog.target.file.id, title: dialog.target.file.title }
          }
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={`Delete “${targetName(dialog.target)}”?`}
          body={`It goes to the Bin${dialog.target.type === 'folder' ? ' with everything inside it' : ''}. You can restore it for ${storage.binDays} days.${canShare ? ' Friends you shared it with can’t open it while it’s in the Bin.' : ''}`}
          confirmLabel="Move to Bin"
          danger
          onConfirm={async () => {
            await notesSend(targetPath(dialog.target), 'DELETE');
            toast.success('Moved to the Bin');
            reload();
          }}
        />
      )}
      <VoiceRecorder
        open={dialog?.kind === 'voice'}
        onOpenChange={(open) => !open && close()}
        onSave={(file, durationS) => uploads.start([{ file, durationS }], folderId)}
      />
    </PageFrame>
  );
}
