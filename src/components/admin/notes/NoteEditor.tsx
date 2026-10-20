'use client';

/**
 * Admin Notes → note editor (V1/NOTES_PLAN.md §4). Write on the left, the exact
 * student view on the right. Drafts autosave; a PUBLISHED note only saves when
 * you press Save, because students read it live.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  HelpCircle,
  History,
  ImagePlus,
  Lightbulb,
  NotebookPen,
  PenLine,
  Pin,
  Save,
  Sigma,
  Table2,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { NOTES_NOTE_TYPES, type NotesAccess, type NotesAdminItem, type NotesCrumb, type NotesItemStatus, type NotesNoteType, type NotesRevision } from '@/lib/notes/types';
import { NotesMarkdown, type NotesLook } from '@/components/notes/NotesMarkdown';
import { PdfViewer } from '@/components/notes/PdfViewer';
import { ImageViewer } from '@/components/notes/ImageViewer';

import { AdminNotesError, adminNotes, adminNotesHref, errorMessage, useAdminNotes } from './admin-notes-api';
import { AccessChip, Btn, ErrorLine, Field, IconBtn, Modal, Panel, StatusChip, formatWhen, inputClass } from './admin-ui';
import { NOTE_TYPE_LABELS } from './LibraryPanel';

const SNIPPETS: Array<{ key: string; label: string; Icon: typeof Sigma; text: string }> = [
  { key: 'formula', label: 'Formula box', Icon: Sigma, text: '\n:::formula{title="Name of the formula"}\n$$a = b + c$$\n$a$ = …, $b$ = …\n:::\n' },
  { key: 'remember', label: 'Remember box', Icon: Pin, text: '\n:::remember\nA fact students must not forget.\n:::\n' },
  { key: 'trap', label: 'Common mistake box', Icon: AlertTriangle, text: '\n:::trap\nA common mistake and how to avoid it.\n:::\n' },
  { key: 'tip', label: 'Tip box', Icon: Lightbulb, text: '\n:::tip\nA shortcut or a memory trick.\n:::\n' },
  { key: 'example', label: 'Example box', Icon: PenLine, text: '\n:::example{title="Example"}\nA short solved example.\n:::\n' },
  { key: 'question', label: 'Question with hidden answer', Icon: HelpCircle, text: '\n:::question{exam="JEE Main"}\nQuestion text\n\n---\n\nAnswer, with a one-line solution\n:::\n' },
  { key: 'table', label: 'Table', Icon: Table2, text: '\n| Quantity | Formula | Unit |\n| --- | --- | --- |\n| Speed | $v = d/t$ | m/s |\n' },
];

type Loaded = { item: NotesAdminItem; breadcrumb: NotesCrumb[] };
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** Shrinks a photo to at most 1600px on its long side before upload. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function VersionsDialog({ itemId, open, onOpenChange, onRestored }: { itemId: string; open: boolean; onOpenChange: (open: boolean) => void; onRestored: () => void }) {
  const { data, loading, error } = useAdminNotes<{ revisions: NotesRevision[] }>(open ? `items/${encodeURIComponent(itemId)}/revisions` : null);
  const [preview, setPreview] = useState<{ id: string; title: string; bodyMd: string | null; version: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const show = async (revision: NotesRevision) => {
    try {
      const body = await adminNotes<{ title: string; bodyMd: string | null; version: number }>(`items/${encodeURIComponent(itemId)}/revisions/${revision.id}`);
      setPreview({ id: revision.id, ...body });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const restore = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await adminNotes(`items/${encodeURIComponent(itemId)}/revisions/${preview.id}/restore`, { method: 'POST' });
      toast.success(`Version ${preview.version} restored as a new version`);
      setPreview(null);
      onOpenChange(false);
      onRestored();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) setPreview(null); onOpenChange(o); }} title="Version history" description="Restoring copies an old version back as the newest one; nothing is lost." wide>
      {preview ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Btn tone="ghost" onClick={() => setPreview(null)}>
              <ChevronLeft className="h-4 w-4" /> All versions
            </Btn>
            <Btn tone="primary" onClick={restore} busy={busy}>Restore version {preview.version}</Btn>
          </div>
          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border p-2">
            <NotesMarkdown markdown={preview.bodyMd ?? ''} look="clean" />
          </div>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorLine message={error} />
      ) : (
        <ul className="divide-y divide-border">
          {(data?.revisions ?? []).map((revision) => (
            <li key={revision.id}>
              <button type="button" onClick={() => show(revision)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:text-primary">
                <span>
                  <span className="font-semibold">Version {revision.version}</span> · {revision.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(revision.createdAt)}
                  {revision.editedByName ? ` · ${revision.editedByName}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function NoteEditor({ itemId }: { itemId: string }) {
  const { data, error, loading, reload } = useAdminNotes<Loaded>(`items/${encodeURIComponent(itemId)}`);
  const [title, setTitle] = useState('');
  const [noteType, setNoteType] = useState<NotesNoteType>('other');
  const [access, setAccess] = useState<NotesAccess>('inherit');
  const [body, setBody] = useState('');
  const [baseVersion, setBaseVersion] = useState(1);
  const [status, setStatus] = useState<NotesItemStatus>('draft');
  const [reviewer, setReviewer] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [conflict, setConflict] = useState<{ currentVersion: number; by: string | null; at: string | null } | null>(null);
  const [look, setLook] = useState<NotesLook>('notebook');
  const [pane, setPane] = useState<'write' | 'preview'>('write');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef<string | null>(null);

  const item = data?.item ?? null;

  // Load the server copy into the form (first load, "load theirs", after restore).
  useEffect(() => {
    if (!item) return;
    const stamp = `${item.id}:${item.version}`;
    if (loadedRef.current === stamp) return;
    loadedRef.current = stamp;
    setTitle(item.title);
    setNoteType(item.noteType);
    setAccess(item.access);
    setBody(item.bodyMd ?? '');
    setBaseVersion(item.version);
    setStatus(item.status);
    setReviewer(item.reviewerName ?? '');
    setSaveState('saved');
    setConflict(null);
  }, [item]);

  const dirty = saveState === 'dirty' || saveState === 'error';

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(
    async (overwriteVersion?: number) => {
      if (!item) return;
      setSaveState('saving');
      try {
        const result = await adminNotes<{ item: NotesAdminItem }>(`items/${item.id}`, {
          method: 'PUT',
          body: {
            baseVersion: overwriteVersion ?? baseVersion,
            title,
            noteType,
            access,
            ...(item.kind === 'typed' ? { bodyMd: body } : {}),
          },
        });
        loadedRef.current = `${result.item.id}:${result.item.version}`;
        setBaseVersion(result.item.version);
        setSaveState('saved');
        setConflict(null);
      } catch (err) {
        setSaveState('error');
        if (err instanceof AdminNotesError && err.code === 'version_conflict') {
          setConflict({
            currentVersion: Number(err.data.currentVersion) || baseVersion,
            by: typeof err.data.updatedByName === 'string' ? err.data.updatedByName : null,
            at: typeof err.data.updatedAt === 'string' ? err.data.updatedAt : null,
          });
        } else {
          toast.error(errorMessage(err));
        }
      }
    },
    [item, baseVersion, title, noteType, access, body],
  );

  // Drafts autosave 3 s after the last change; live notes wait for Save.
  useEffect(() => {
    if (saveState !== 'dirty' || conflict || status === 'published') return;
    const timer = window.setTimeout(() => void save(), 3000);
    return () => window.clearTimeout(timer);
  }, [saveState, conflict, status, save, body, title]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, save]);

  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setSaveState('dirty');
  };

  const insert = (text: string) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? body.length;
    const end = area?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    setSaveState('dirty');
    requestAnimationFrame(() => {
      area?.focus();
      const cursor = start + text.length;
      area?.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImage = async (file: File) => {
    setBusy('image');
    try {
      const form = new FormData();
      const blob = await shrinkImage(file);
      form.append('file', blob, blob === file ? file.name : file.name.replace(/\.[^.]+$/u, '.webp'));
      const result = await adminNotes<{ url: string }>('uploads/diagram', { method: 'POST', form });
      insert(`\n![${file.name.replace(/\.[^.]+$/u, '')}](${result.url})\n`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = async (next: NotesItemStatus) => {
    if (!item) return;
    if (dirty) await save();
    let reviewerName = reviewer.trim() || null;
    if (next === 'published' && item.source === 'import' && !reviewerName) {
      reviewerName = window.prompt('Who checked this note? (teacher name — required for imported notes)')?.trim() || null;
      if (!reviewerName) return;
      setReviewer(reviewerName);
    }
    setBusy(next);
    try {
      const result = await adminNotes<{ item: NotesAdminItem }>(`items/${item.id}/status`, { method: 'POST', body: { status: next, reviewerName } });
      setStatus(result.item.status);
      toast.success(next === 'published' ? 'Published — students can read it now' : next === 'in_review' ? 'Sent for review' : 'Back to draft');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <Panel><p className="text-sm text-muted-foreground">Loading note…</p></Panel>;
  if (error || !item || !data) return <Panel><ErrorLine message={error ?? 'Could not load this note.'} /></Panel>;

  const folderCrumb = data.breadcrumb[data.breadcrumb.length - 1];
  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? `Saved · v${baseVersion}` : saveState === 'error' ? 'Not saved' : status === 'published' ? 'Unsaved changes' : 'Unsaved — saving soon';

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={adminNotesHref({ folder: item.folderId })} className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> {folderCrumb?.name ?? 'Back to folder'}
          </Link>
          <span className="ml-auto flex items-center gap-2">
            <StatusChip status={status} />
            <AccessChip access={access} effective={access === 'premium' ? 'premium' : 'free'} />
            <span className={cn('text-xs', saveState === 'error' ? 'text-destructive' : '')} aria-live="polite">
              {saveLabel}
            </span>
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_200px_180px]">
          <Field label="Title">
            <input className={inputClass} value={title} onChange={(e) => change(setTitle)(e.target.value)} maxLength={160} />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={noteType} onChange={(e) => change(setNoteType)(e.target.value as NotesNoteType)}>
              {NOTES_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>{NOTE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </Field>
          <Field label="Who can read it">
            <select className={inputClass} value={access} onChange={(e) => change(setAccess)(e.target.value as NotesAccess)}>
              <option value="inherit">Same as folder</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Checked by (teacher)" hint={item.source === 'import' ? 'Required before an imported note can be published.' : 'Optional.'}>
            <input className={cn(inputClass, 'w-64')} value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={80} placeholder="Name of the subject teacher" />
          </Field>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn onClick={() => setVersionsOpen(true)}>
              <History className="h-4 w-4" /> Versions
            </Btn>
            <Btn onClick={() => void save()} disabled={!dirty} busy={saveState === 'saving'}>
              <Save className="h-4 w-4" /> Save
            </Btn>
            {status !== 'in_review' && status !== 'published' && (
              <Btn onClick={() => changeStatus('in_review')} busy={busy === 'in_review'}>Send for review</Btn>
            )}
            {status !== 'published' ? (
              <Btn tone="primary" onClick={() => changeStatus('published')} busy={busy === 'published'}>Publish</Btn>
            ) : (
              <Btn onClick={() => changeStatus('draft')} busy={busy === 'draft'}>Unpublish</Btn>
            )}
          </div>
        </div>

        {status === 'published' && item.kind === 'typed' && (
          <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm">This note is live. Your changes reach students when you press Save.</p>
        )}
        {conflict && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm">
            <span className="flex-1">
              {conflict.by ?? 'Someone else'} saved this note{conflict.at ? ` at ${formatWhen(conflict.at)}` : ''} while you were editing.
            </span>
            <Btn onClick={() => { loadedRef.current = null; setConflict(null); reload(); }}>Load their version</Btn>
            <Btn tone="danger" onClick={() => void save(conflict.currentVersion)}>Keep mine (overwrite)</Btn>
          </div>
        )}
      </Panel>

      {item.kind === 'typed' ? (
        <>
          <div className="flex gap-2 lg:hidden">
            <Btn tone={pane === 'write' ? 'primary' : 'secondary'} onClick={() => setPane('write')}>Write</Btn>
            <Btn tone={pane === 'preview' ? 'primary' : 'secondary'} onClick={() => setPane('preview')}>Preview</Btn>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className={cn(pane === 'preview' && 'hidden lg:block')}>
              <div className="mb-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Insert">
                {SNIPPETS.map((snippet) => (
                  <IconBtn key={snippet.key} label={snippet.label} onClick={() => insert(snippet.text)}>
                    <snippet.Icon className="h-4 w-4" />
                  </IconBtn>
                ))}
                <IconBtn label="Insert a diagram image" onClick={() => imageInputRef.current?.click()} disabled={busy === 'image'}>
                  <ImagePlus className="h-4 w-4" />
                </IconBtn>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = '';
                    if (file) void uploadImage(file);
                  }}
                />
                <span className="ml-auto text-xs text-muted-foreground">Maths: $…$ inline, $$…$$ on its own line</span>
              </div>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => change(setBody)(e.target.value)}
                spellCheck
                aria-label="Note text (Markdown)"
                className="min-h-[60vh] w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-primary"
              />
            </Panel>
            <Panel
              className={cn(pane === 'write' && 'hidden lg:block')}
              title="What students see"
              actions={
                <IconBtn label={look === 'notebook' ? 'Show clean style' : 'Show notebook style'} onClick={() => setLook(look === 'notebook' ? 'clean' : 'notebook')}>
                  {look === 'notebook' ? <Type className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
                </IconBtn>
              }
            >
              <div className="max-h-[70vh] overflow-y-auto">
                <NotesMarkdown markdown={body} look={look} />
              </div>
            </Panel>
          </div>
        </>
      ) : (
        <Panel title={item.kind === 'pdf' ? 'PDF preview' : 'Photo preview'}>
          {item.kind === 'pdf' ? (
            <PdfViewer
              resolveUrl={async () => (await adminNotes<{ url: string }>(`items/${item.id}/file?format=json`)).url}
              downloadHref={`/api/admin/notes/items/${item.id}/file`}
            />
          ) : (
            <ImageViewer src={`/api/admin/notes/items/${item.id}/file`} alt={item.title} />
          )}
        </Panel>
      )}

      <VersionsDialog itemId={item.id} open={versionsOpen} onOpenChange={setVersionsOpen} onRestored={() => { loadedRef.current = null; reload(); }} />
    </div>
  );
}
