'use client';

/**
 * Admin Notes → Library tab: the folder tree, one folder's contents, and every
 * folder/item action (V1/NOTES_PLAN.md §4).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  Library,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { LIBRARY_MAX_FILE_BYTES, LIBRARY_UPLOAD_KINDS, extensionMatchesType, fileTypeForMime } from '@/lib/notes/file-types';
import { formatBytes, moveInList, subjectLabel } from '@/lib/notes/rules';
import { chapterLabel } from '@/lib/notes/syllabus';
import {
  NOTES_EXAMS,
  NOTES_NOTE_TYPES,
  type NotesAccess,
  type NotesAdminFolder,
  type NotesAdminItem,
  type NotesCrumb,
  type NotesExam,
  type NotesNoteType,
} from '@/lib/notes/types';

import { pdfPageCount } from '@/components/notes/upload-helpers';
import { adminNotes, adminNotesHref, errorMessage, putWithProgress, useAdminNotes } from './admin-notes-api';
import { AccessChip, Btn, ErrorLine, Field, IconBtn, Modal, Panel, StatusChip, formatWhen, inputClass } from './admin-ui';

export const NOTE_TYPE_LABELS: Record<NotesNoteType, string> = {
  formula_sheet: 'Formula sheet',
  short_notes: 'Short notes',
  key_points: 'Important points and traps',
  practice: 'Quick practice',
  other: 'Other',
};

type TreePayload = { folders: NotesAdminFolder[]; roots: string[] };
type FolderPayload = { folder: NotesAdminFolder | null; breadcrumb: NotesCrumb[]; folders: NotesAdminFolder[]; items: NotesAdminItem[] };

function folderName(folder: Pick<NotesAdminFolder, 'name' | 'kind' | 'ncertNumber'>): string {
  return folder.kind === 'chapter' ? chapterLabel(folder.name, folder.ncertNumber) : folder.name;
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

function TreeNode({
  id,
  byId,
  childrenOf,
  selectedId,
  open,
  toggle,
  depth,
}: {
  id: string;
  byId: Map<string, NotesAdminFolder>;
  childrenOf: Map<string | null, string[]>;
  selectedId: string | null;
  open: Set<string>;
  toggle: (id: string) => void;
  depth: number;
}) {
  const folder = byId.get(id);
  if (!folder) return null;
  const kids = childrenOf.get(id) ?? [];
  const isOpen = open.has(id);
  return (
    <li>
      <div className={cn('flex items-center rounded-lg', selectedId === id ? 'bg-primary/12 text-primary' : 'hover:bg-surface-2')} style={{ paddingLeft: depth * 12 }}>
        <button
          type="button"
          onClick={() => toggle(id)}
          className={cn('flex h-8 w-7 shrink-0 items-center justify-center', kids.length === 0 && 'invisible')}
          aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Link href={adminNotesHref({ folder: id })} className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-sm">
          <Folder className={cn('h-4 w-4 shrink-0', folder.visible ? 'text-emerald-500' : 'text-muted-foreground')} aria-hidden />
          <span className="truncate">{folderName(folder)}</span>
          {folder.counts.published + folder.counts.inReview + folder.counts.draft > 0 && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{folder.counts.published + folder.counts.inReview + folder.counts.draft}</span>
          )}
        </Link>
      </div>
      {isOpen && kids.length > 0 && (
        <ul>
          {kids.map((child) => (
            <TreeNode key={child} id={child} byId={byId} childrenOf={childrenOf} selectedId={selectedId} open={open} toggle={toggle} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderTree({ tree, selectedId }: { tree: TreePayload | null; selectedId: string | null }) {
  const { byId, childrenOf } = useMemo(() => {
    const map = new Map<string, NotesAdminFolder>();
    const kids = new Map<string | null, string[]>();
    for (const folder of tree?.folders ?? []) map.set(folder.id, folder);
    for (const folder of [...(tree?.folders ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
      const list = kids.get(folder.parentId) ?? [];
      list.push(folder.id);
      kids.set(folder.parentId, list);
    }
    return { byId: map, childrenOf: kids };
  }, [tree]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Keep the selected folder's parents expanded.
  useEffect(() => {
    if (!selectedId) return;
    const next = new Set(open);
    let cursor = byId.get(selectedId)?.parentId ?? null;
    let changed = false;
    while (cursor) {
      if (!next.has(cursor)) {
        next.add(cursor);
        changed = true;
      }
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    if (changed) setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, byId]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav aria-label="Library folders" className="max-h-[75vh] overflow-y-auto pr-1">
      <Link
        href={adminNotesHref({})}
        className={cn('mb-1 flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold', !selectedId ? 'bg-primary/12 text-primary' : 'hover:bg-surface-2')}
      >
        <Library className="h-4 w-4" aria-hidden /> Library
      </Link>
      <ul>
        {(childrenOf.get(null) ?? []).map((id) => (
          <TreeNode key={id} id={id} byId={byId} childrenOf={childrenOf} selectedId={selectedId} open={open} toggle={toggle} depth={0} />
        ))}
      </ul>
    </nav>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function FolderPicker({ tree, value, onChange, excludeId }: { tree: TreePayload | null; value: string | null; onChange: (id: string | null) => void; excludeId?: string }) {
  const options = useMemo(() => {
    const folders = tree?.folders ?? [];
    const byId = new Map(folders.map((f) => [f.id, f]));
    const pathOf = (folder: NotesAdminFolder): string[] => {
      const names: string[] = [];
      let cursor: NotesAdminFolder | undefined = folder;
      let guard = 0;
      while (cursor && guard < 20) {
        names.unshift(folderName(cursor));
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
        guard += 1;
      }
      return names;
    };
    const isInside = (folder: NotesAdminFolder): boolean => {
      let cursor: NotesAdminFolder | undefined = folder;
      let guard = 0;
      while (cursor && guard < 20) {
        if (cursor.id === excludeId) return true;
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
        guard += 1;
      }
      return false;
    };
    return folders
      .filter((f) => !excludeId || !isInside(f))
      .map((f) => ({ id: f.id, label: pathOf(f).join(' › ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  }, [tree, excludeId]);
  return (
    <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Library (top level)</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function UploadDialog({ folderId, open, onOpenChange, onDone }: { folderId: string; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setProgress(null);
    setError(null);
  };

  const start = async () => {
    if (!file) return;
    setError(null);
    const type = fileTypeForMime(file.type);
    if (!type || !LIBRARY_UPLOAD_KINDS.includes(type.kind) || !extensionMatchesType(file.name, type)) {
      setError('Pick a PDF or a photo (JPG, PNG or WebP).');
      return;
    }
    if (file.size > LIBRARY_MAX_FILE_BYTES) {
      setError(`Files can be up to ${formatBytes(LIBRARY_MAX_FILE_BYTES)}. This one is ${formatBytes(file.size)}.`);
      return;
    }
    try {
      setProgress(0);
      const [ticket, pageCount] = await Promise.all([
        adminNotes<{ uploadId: string; uploadUrl: string; headers: Record<string, string> }>('uploads', {
          method: 'POST',
          body: { folderId, fileName: file.name, mime: type.mime, bytes: file.size, title: title.trim() || null },
        }),
        pdfPageCount(file),
      ]);
      await putWithProgress(ticket.uploadUrl, file, ticket.headers, setProgress);
      await adminNotes(`uploads/${ticket.uploadId}/complete`, { method: 'POST', body: { pageCount } });
      toast.success('File added as a draft');
      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      setProgress(null);
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Upload a file"
      description="A PDF or a photo of handwritten notes, up to 50 MB. It's added as a draft."
    >
      <div className="space-y-3">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setFile(picked);
            if (picked && !title) setTitle(picked.name.replace(/\.[^.]+$/u, '').replace(/[_-]+/gu, ' '));
          }}
          className="block w-full text-sm"
        />
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </Field>
        {file && <p className="text-xs text-muted-foreground">{`${file.name} · ${formatBytes(file.size)}`}</p>}
        {progress !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <ErrorLine message={error} />
        <div className="flex justify-end gap-2">
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn tone="primary" onClick={start} disabled={!file} busy={progress !== null}>
            {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : 'Upload'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function BankChapterEditor({ folder, onSaved }: { folder: NotesAdminFolder; onSaved: () => void }) {
  const [options, setOptions] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>(folder.bankChapters);
  const [busy, setBusy] = useState(false);
  const subject = folder.effectiveSubject;
  const classLevel = folder.effectiveClassLevel;

  useEffect(() => setSelected(folder.bankChapters), [folder.bankChapters]);
  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    adminNotes<{ chapters: string[] }>(`bank-chapters?subject=${subject}${classLevel ? `&class=${classLevel}` : ''}`)
      .then((result) => !cancelled && setOptions(result.chapters))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [subject, classLevel]);

  if (!subject) return <p className="text-sm text-muted-foreground">Put this chapter inside a subject folder to link it to practice questions.</p>;

  const all = [...new Set([...(options ?? []), ...folder.bankChapters])].sort();
  const save = async () => {
    setBusy(true);
    try {
      await adminNotes(`folders/${folder.id}`, { method: 'PUT', body: { bankChapters: selected } });
      toast.success('Practice link saved');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        &ldquo;Practise this chapter&rdquo; opens OG Code filtered to these question-bank chapters ({subjectLabel(subject)}
        {classLevel ? `, Class ${classLevel}` : ''}).
      </p>
      {options === null ? (
        <p className="text-sm text-muted-foreground">Loading question-bank chapters…</p>
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">The question bank has no chapters for this subject and class here.</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
          {all.map((chapter) => (
            <label key={chapter} className="flex min-h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(chapter)}
                onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, chapter] : cur.filter((c) => c !== chapter)))}
              />
              <span>{chapter}</span>
              {!options.includes(chapter) && <span className="text-xs text-destructive">(not in the bank here)</span>}
            </label>
          ))}
        </div>
      )}
      <Btn tone="primary" onClick={save} busy={busy} disabled={JSON.stringify([...selected].sort()) === JSON.stringify([...folder.bankChapters].sort())}>
        Save practice link
      </Btn>
    </div>
  );
}

// ─── Folder panel ─────────────────────────────────────────────────────────────

function FolderPanel({ folderId, tree, reloadTree }: { folderId: string | null; tree: TreePayload | null; reloadTree: () => void }) {
  const router = useRouter();
  const path = `folders/${folderId ? encodeURIComponent(folderId) : 'root'}`;
  const { data, error, loading, reload } = useAdminNotes<FolderPayload>(path);
  const [dialog, setDialog] = useState<null | 'folder' | 'note' | 'upload' | 'rename' | 'move' | 'chapter'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState<NotesNoteType>('short_notes');
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const refresh = () => {
    reload();
    reloadTree();
  };

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const folder = data?.folder ?? null;
  const isRoot = !folderId;

  const reorder = (kind: 'folders' | 'items', ids: string[], id: string, delta: number) => {
    const index = ids.indexOf(id);
    const next = moveInList(ids, id, index + delta);
    void run(`reorder-${id}`, () => adminNotes('reorder', { method: 'POST', body: { kind, parentId: folderId, orderedIds: next } }));
  };

  const createFolder = async () => {
    setDialogError(null);
    try {
      await adminNotes('folders', { method: 'POST', body: { parentId: folderId, name } });
      setDialog(null);
      setName('');
      toast.success('Folder created (draft)');
      refresh();
    } catch (err) {
      setDialogError(errorMessage(err));
    }
  };

  const createNote = async () => {
    if (!folderId) return;
    setDialogError(null);
    try {
      const result = await adminNotes<{ item: NotesAdminItem }>('items', {
        method: 'POST',
        body: { folderId, title: noteTitle, noteType, bodyMd: `## ${noteTitle.trim() || 'New note'}\n\n` },
      });
      setDialog(null);
      setNoteTitle('');
      refresh();
      router.push(adminNotesHref({ folder: folderId, item: result.item.id }));
    } catch (err) {
      setDialogError(errorMessage(err));
    }
  };

  const rename = async () => {
    if (!folder) return;
    setDialogError(null);
    try {
      await adminNotes(`folders/${folder.id}`, { method: 'PUT', body: { name } });
      setDialog(null);
      refresh();
    } catch (err) {
      setDialogError(errorMessage(err));
    }
  };

  const move = async () => {
    if (!folder) return;
    setDialogError(null);
    try {
      await adminNotes(`folders/${folder.id}/move`, { method: 'POST', body: { parentId: moveTarget } });
      setDialog(null);
      toast.success('Folder moved');
      refresh();
    } catch (err) {
      setDialogError(errorMessage(err));
    }
  };

  const setPublished = (target: NotesAdminFolder, publish: boolean) =>
    run(
      `publish-${target.id}`,
      () => adminNotes(`folders/${target.id}`, { method: 'PUT', body: { status: publish ? 'published' : 'draft', publishParents: publish } }),
      publish ? 'Published (with any draft folders above it)' : 'Back to draft — students no longer see it',
    );

  const removeFolder = (target: NotesAdminFolder) => {
    const total = target.counts.published + target.counts.inReview + target.counts.draft;
    if (!window.confirm(`Move "${target.name}"${total ? ` and the notes in it` : ''} to the Bin? You can restore it from the Bin tab.`)) return;
    void run(`delete-${target.id}`, async () => {
      await adminNotes(`folders/${target.id}`, { method: 'DELETE' });
      if (target.id === folderId) router.push(adminNotesHref({ folder: target.parentId }));
    }, 'Moved to the Bin');
  };

  const setItemStatus = (item: NotesAdminItem, status: 'draft' | 'published') => {
    let reviewerName: string | null = null;
    if (status === 'published' && item.source === 'import' && !item.reviewerName) {
      reviewerName = window.prompt('Who checked this note? (teacher name — required for imported notes)')?.trim() || null;
      if (!reviewerName) return;
    }
    void run(`status-${item.id}`, () => adminNotes(`items/${item.id}/status`, { method: 'POST', body: { status, reviewerName } }), status === 'published' ? 'Published' : 'Back to draft');
  };

  const removeItem = (item: NotesAdminItem) => {
    if (!window.confirm(`Move "${item.title}" to the Bin?`)) return;
    void run(`delete-${item.id}`, () => adminNotes(`items/${item.id}`, { method: 'DELETE' }), 'Moved to the Bin');
  };

  const createStandard = () => {
    if (!window.confirm('Create the Class 10, 11 and 12 subject and chapter folders as drafts? Existing folders are kept.')) return;
    void run(
      'standard',
      async () => {
        const result = await adminNotes<{ created: number; adopted: number; skipped: number }>('standard-folders', { method: 'POST', body: {} });
        toast.success(`Created ${result.created}, linked ${result.adopted}, already there ${result.skipped}`);
      },
    );
  };

  if (loading && !data) return <Panel><p className="text-sm text-muted-foreground">Loading…</p></Panel>;
  if (error || !data) return <Panel><ErrorLine message={error ?? 'Could not load this folder.'} /></Panel>;

  const folderIds = data.folders.map((f) => f.id);
  const itemIds = data.items.map((i) => i.id);

  return (
    <div className="space-y-4">
      <Panel>
        <nav aria-label="Folder path" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href={adminNotesHref({})} className="hover:text-foreground">Library</Link>
          {data.breadcrumb.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <Link href={adminNotesHref({ folder: crumb.id })} className="hover:text-foreground">
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-bold">{folder ? folderName(folder) : 'Library'}</h2>
            {folder && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{folder.kind}</span>
                <StatusChip status={folder.status} hidden={!folder.visible} />
                <AccessChip access={folder.access} effective={folder.effectiveAccess} />
                {folder.effectiveSubject && <span className="text-xs text-muted-foreground">{subjectLabel(folder.effectiveSubject)}</span>}
                {folder.effectiveClassLevel && <span className="text-xs text-muted-foreground">· Class {folder.effectiveClassLevel}</span>}
              </div>
            )}
          </div>
          {folder && (
            <div className="flex flex-wrap items-center gap-2">
              {folder.status === 'published' ? (
                <Btn onClick={() => setPublished(folder, false)} busy={busy === `publish-${folder.id}`}>
                  <EyeOff className="h-4 w-4" /> Unpublish
                </Btn>
              ) : (
                <Btn tone="primary" onClick={() => setPublished(folder, true)} busy={busy === `publish-${folder.id}`}>
                  <Eye className="h-4 w-4" /> Publish
                </Btn>
              )}
              <select
                className={cn(inputClass, 'h-10 w-auto rounded-full')}
                value={folder.access}
                aria-label="Who can read this folder"
                onChange={(e) =>
                  void run('access', () => adminNotes(`folders/${folder.id}`, { method: 'PUT', body: { access: e.target.value as NotesAccess } }), 'Access updated')
                }
              >
                <option value="inherit">Same as parent</option>
                <option value="free">Free for everyone</option>
                <option value="premium">Premium only</option>
              </select>
              <IconBtn label="Rename" onClick={() => { setName(folder.name); setDialogError(null); setDialog('rename'); }}>
                <Pencil className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Move" onClick={() => { setMoveTarget(folder.parentId); setDialogError(null); setDialog('move'); }}>
                <FolderInput className="h-4 w-4" />
              </IconBtn>
              {folder.kind === 'chapter' && (
                <IconBtn label="Chapter settings" onClick={() => setDialog('chapter')}>
                  <Sparkles className="h-4 w-4" />
                </IconBtn>
              )}
              <IconBtn label="Move to Bin" onClick={() => removeFolder(folder)} className="hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => { setName(''); setDialogError(null); setDialog('folder'); }}>
            <FolderPlus className="h-4 w-4" /> New folder
          </Btn>
          {!isRoot && (
            <>
              <Btn onClick={() => { setNoteTitle(''); setDialogError(null); setDialog('note'); }}>
                <FilePlus2 className="h-4 w-4" /> New note
              </Btn>
              <Btn onClick={() => setDialog('upload')}>
                <Upload className="h-4 w-4" /> Upload file
              </Btn>
            </>
          )}
          {isRoot && (
            <Btn onClick={createStandard} busy={busy === 'standard'}>
              <Library className="h-4 w-4" /> Create standard folders
            </Btn>
          )}
        </div>
      </Panel>

      <Panel title={`Inside (${data.folders.length + data.items.length})`}>
        {data.folders.length + data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isRoot ? 'The library is empty. Use "Create standard folders" to add Class 10, 11 and 12 with every chapter.' : 'Nothing here yet. Add a note, upload a file or make a folder.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.folders.map((child, index) => (
              <li key={child.id} className="flex items-center gap-2 py-2">
                <Folder className={cn('h-5 w-5 shrink-0', child.visible ? 'text-emerald-500' : 'text-muted-foreground')} aria-hidden />
                <Link href={adminNotesHref({ folder: child.id })} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{folderName(child)}</span>
                  <span className="text-xs text-muted-foreground">
                    {child.counts.published} published · {child.counts.inReview} in review · {child.counts.draft} draft
                  </span>
                </Link>
                <StatusChip status={child.status} hidden={!child.visible} />
                <IconBtn label="Move up" disabled={index === 0} onClick={() => reorder('folders', folderIds, child.id, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Move down" disabled={index === data.folders.length - 1} onClick={() => reorder('folders', folderIds, child.id, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={child.status === 'published' ? 'Unpublish' : 'Publish'} onClick={() => setPublished(child, child.status !== 'published')}>
                  {child.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </IconBtn>
              </li>
            ))}
            {data.items.map((item, index) => {
              const Icon = item.kind === 'pdf' ? FileText : item.kind === 'image' ? ImageIcon : FileText;
              return (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <Link href={adminNotesHref({ folder: folderId, item: item.id })} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.kind === 'typed' ? NOTE_TYPE_LABELS[item.noteType] : `${item.kind.toUpperCase()} · ${formatBytes(item.bytes)}`}
                      {item.source === 'import' ? ' · imported' : ''} · v{item.version} · {formatWhen(item.updatedAt)}
                      {item.updatedByName ? ` by ${item.updatedByName}` : ''}
                    </span>
                  </Link>
                  <StatusChip status={item.status} hidden={item.status === 'published' && !(folder?.visible ?? false)} />
                  <IconBtn label="Move up" disabled={index === 0} onClick={() => reorder('items', itemIds, item.id, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Move down" disabled={index === data.items.length - 1} onClick={() => reorder('items', itemIds, item.id, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label={item.status === 'published' ? 'Unpublish' : 'Publish'} onClick={() => setItemStatus(item, item.status === 'published' ? 'draft' : 'published')}>
                    {item.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn label="Move to Bin" onClick={() => removeItem(item)} className="hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal open={dialog === 'folder'} onOpenChange={(o) => !o && setDialog(null)} title="New folder" description="Starts as a draft. Students see it once it's published.">
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </Field>
          <ErrorLine message={dialogError} />
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setDialog(null)}>Cancel</Btn>
            <Btn tone="primary" onClick={createFolder} disabled={!name.trim()}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'note'} onOpenChange={(o) => !o && setDialog(null)} title="New typed note" description="Opens the editor. It stays a draft until you publish it.">
        <div className="space-y-3">
          <Field label="Title">
            <input className={inputClass} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} maxLength={160} autoFocus placeholder="Motion in a Plane: Formula Sheet" />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={noteType} onChange={(e) => setNoteType(e.target.value as NotesNoteType)}>
              {NOTES_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>{NOTE_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </Field>
          <ErrorLine message={dialogError} />
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setDialog(null)}>Cancel</Btn>
            <Btn tone="primary" onClick={createNote} disabled={!noteTitle.trim()}>Create and edit</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'rename'} onOpenChange={(o) => !o && setDialog(null)} title="Rename folder">
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </Field>
          <ErrorLine message={dialogError} />
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setDialog(null)}>Cancel</Btn>
            <Btn tone="primary" onClick={rename} disabled={!name.trim()}>Save</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'move'} onOpenChange={(o) => !o && setDialog(null)} title="Move folder" description="Pick where it should go. A folder can't go inside itself.">
        <div className="space-y-3">
          <FolderPicker tree={tree} value={moveTarget} onChange={setMoveTarget} excludeId={folder?.id} />
          <ErrorLine message={dialogError} />
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setDialog(null)}>Cancel</Btn>
            <Btn tone="primary" onClick={move}>Move here</Btn>
          </div>
        </div>
      </Modal>

      {folder && folder.kind === 'chapter' && (
        <Modal open={dialog === 'chapter'} onOpenChange={(o) => !o && setDialog(null)} title="Chapter settings" wide>
          <ChapterSettings folder={folder} onSaved={refresh} />
        </Modal>
      )}

      {folderId && <UploadDialog folderId={folderId} open={dialog === 'upload'} onOpenChange={(o) => !o && setDialog(null)} onDone={refresh} />}
    </div>
  );
}

function ChapterSettings({ folder, onSaved }: { folder: NotesAdminFolder; onSaved: () => void }) {
  const [ncert, setNcert] = useState<string>(folder.ncertNumber ? String(folder.ncertNumber) : '');
  const [exams, setExams] = useState<NotesExam[]>(folder.exams);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await adminNotes(`folders/${folder.id}`, { method: 'PUT', body: { ncertNumber: ncert ? Number(ncert) : null, exams } });
      toast.success('Chapter details saved');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="NCERT chapter number" hint="Leave empty for exam-only topics.">
          <input className={inputClass} inputMode="numeric" value={ncert} onChange={(e) => setNcert(e.target.value.replace(/\D/gu, '').slice(0, 2))} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Exams</legend>
          <div className="flex flex-wrap gap-3">
            {NOTES_EXAMS.map((exam) => (
              <label key={exam} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={exams.includes(exam)} onChange={(e) => setExams((cur) => (e.target.checked ? [...cur, exam] : cur.filter((x) => x !== exam)))} />
                {exam === 'jee' ? 'JEE' : exam === 'neet' ? 'NEET' : 'Boards'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Btn tone="primary" onClick={save} busy={busy}>Save details</Btn>
      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-bold">Practice questions link</h3>
        <BankChapterEditor folder={folder} onSaved={onSaved} />
      </div>
    </div>
  );
}

export function LibraryPanel({ folderId }: { folderId: string | null }) {
  const { data: tree, reload: reloadTree } = useAdminNotes<TreePayload>('tree');
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Panel className="hidden lg:block">
        <FolderTree tree={tree} selectedId={folderId} />
      </Panel>
      <FolderPanel key={folderId ?? 'root'} folderId={folderId} tree={tree} reloadTree={reloadTree} />
    </div>
  );
}
