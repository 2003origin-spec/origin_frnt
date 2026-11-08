'use client';

import Link from 'next/link';
import { Target } from 'lucide-react';
import { toast } from 'sonner';

import type { NotesFolderPayload, NotesItemCard } from '@/lib/notes/types';

import { notesHref, notesSend, useNotesQuery } from './notes-client';
import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  ExamChips,
  FolderRow,
  ItemRow,
  LoadingRows,
  PageFrame,
  PrimaryLink,
  SecondaryLink,
  TopBar,
  folderTitle,
} from './notes-ui';

export function NotesFolderView({ folderId, showAll }: { folderId: string; showAll: boolean }) {
  const path = `library/folders/${encodeURIComponent(folderId)}${showAll ? '?all=1' : ''}`;
  const { data, error, loading, reload, setData } = useNotesQuery<NotesFolderPayload>(path);

  const parent = data && data.breadcrumb.length > 1 ? data.breadcrumb[data.breadcrumb.length - 2] : null;
  const backHref = parent ? notesHref({ folder: parent.id }) : '/notes';

  const toggleStar = async (item: NotesItemCard) => {
    if (!data) return;
    const next = !item.starred;
    const update = (starred: boolean) =>
      setData({ ...data, items: data.items.map((entry) => (entry.id === item.id ? { ...entry, starred } : entry)) });
    update(next);
    try {
      await notesSend(`library/items/${encodeURIComponent(item.id)}/star`, next ? 'POST' : 'DELETE');
    } catch {
      update(!next);
      toast.error('Could not update starred notes. Try again.');
    }
  };

  if (loading && !data) {
    return (
      <PageFrame>
        <TopBar backHref="/notes" backLabel="Back" title="" />
        <LoadingRows />
      </PageFrame>
    );
  }
  if (error || !data) {
    return (
      <PageFrame>
        <TopBar backHref="/notes" backLabel="Back to Notes" title="Notes" />
        {error?.status === 404 ? (
          <EmptyState title="This folder isn't available" body="It may have been moved or isn't published yet." action={<PrimaryLink href="/notes">Back to Notes</PrimaryLink>} />
        ) : (
          <ErrorState message={error?.message ?? 'Could not load this folder.'} onRetry={reload} />
        )}
      </PageFrame>
    );
  }

  const { folder } = data;
  const isEmpty = data.folders.length === 0 && data.items.length === 0;
  const isChapter = folder.kind === 'chapter';

  return (
    <PageFrame>
      <TopBar backHref={backHref} backLabel={parent ? `Back to ${parent.name}` : 'Back to Notes'} title={folderTitle(folder)} />
      <Breadcrumbs crumbs={data.breadcrumb} hrefFor={(id) => notesHref({ folder: id })} />

      {isChapter && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ExamChips exams={folder.exams} examOnly={folder.ncertNumber === null && folder.exams.some((e) => e !== 'boards')} />
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          title={isChapter ? 'Notes for this chapter are coming soon' : 'Nothing here yet'}
          body={isChapter ? 'Meanwhile, practise questions from this chapter.' : 'New notes are added regularly.'}
          action={folder.practiseUrl ? <PrimaryLink href={folder.practiseUrl}>Practise this chapter</PrimaryLink> : <SecondaryLink href={backHref}>Go back</SecondaryLink>}
        />
      ) : (
        <div className="space-y-5">
          {data.folders.length > 0 && (
            <ul className="space-y-2" aria-label="Folders">
              {data.folders.map((child) => (
                <li key={child.id}>
                  <FolderRow folder={child} href={notesHref({ folder: child.id })} />
                </li>
              ))}
            </ul>
          )}

          {data.hiddenSubjects > 0 && (
            <Link href={notesHref({ folder: folder.id, all: true })} className="inline-flex min-h-12 items-center text-sm font-semibold text-primary">
              Show all subjects ({data.hiddenSubjects} hidden by your study mode)
            </Link>
          )}
          {data.showingAllSubjects && folder.kind === 'class' && (
            <Link href={notesHref({ folder: folder.id })} className="inline-flex min-h-12 items-center text-sm font-semibold text-primary">
              Show only my subjects
            </Link>
          )}

          {data.items.length > 0 && (
            <ul className="space-y-2" aria-label="Notes">
              {data.items.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} href={notesHref({ note: item.id })} onToggleStar={toggleStar} />
                </li>
              ))}
            </ul>
          )}

          {folder.practiseUrl && (
            <Link
              href={folder.practiseUrl}
              className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 text-sm font-semibold text-primary hover:bg-primary/15"
            >
              <Target className="h-5 w-5" aria-hidden /> Practise this chapter
            </Link>
          )}
        </div>
      )}
    </PageFrame>
  );
}
