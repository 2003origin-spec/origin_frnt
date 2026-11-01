'use client';

/**
 * Origin Notes — the student Notes page (V1/NOTES_PLAN.md §3).
 *
 * One page; where you are lives in the URL query so links can be shared and
 * the back button works:  ?f=<folder>  ?n=<note>  ?tab=starred|recent  ?q=<search>
 * My Notes:  ?tab=mine[&mf=<folder>|&file=<file>|&mq=<search>]  ?tab=bin
 * Shared with me:  ?tab=shared[&share=<share>[&sf=<folder>|&sfile=<file>]]
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { BookOpenCheck, ChevronRight, Clock3, FolderHeart, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { NotesHomePayload, NotesItemCard, NotesSearchHit } from '@/lib/notes/types';
import type { MyStorageSummary } from '@/lib/notes/my-types';
import { formatBytes } from '@/lib/notes/rules';

import { NotesFolderView } from './NotesFolderView';
import { NotesReader } from './NotesReader';
import { MyBinView } from './my/MyBinView';
import { MyFileView } from './my/MyFileView';
import { MyNotesView, MySearchView } from './my/MyNotesView';
import { notesHref, notesSend, useNotesQuery } from './notes-client';
import { SharedFileView, SharedFolderView, SharedWithMeCard, SharedWithMeView } from './shared/SharedViews';
import {
  EmptyState,
  ErrorState,
  ItemRow,
  LoadingRows,
  PageFrame,
  PrimaryLink,
  TopBar,
  subjectTone,
} from './notes-ui';

function SearchBox({ initial = '', autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (q.length >= 2) router.push(notesHref({ q }));
  };
  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search notes, chapters, formulas"
        aria-label="Search notes"
        autoFocus={autoFocus}
        enterKeyHint="search"
        className="h-12 w-full rounded-full border border-border bg-surface-1 pl-12 pr-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary"
      />
    </form>
  );
}

/** Starring from a list updates the row at once and rolls back on failure. */
function useStarToggle<T extends NotesItemCard>(items: T[] | null, setItems: (next: T[]) => void) {
  return async (item: NotesItemCard) => {
    if (!items) return;
    const next = !item.starred;
    setItems(items.map((entry) => (entry.id === item.id ? { ...entry, starred: next } : entry)));
    try {
      await notesSend(`library/items/${encodeURIComponent(item.id)}/star`, next ? 'POST' : 'DELETE');
    } catch {
      setItems(items);
      toast.error('Could not update starred notes. Try again.');
    }
  };
}

function MyNotesCard() {
  const { data } = useNotesQuery<MyStorageSummary>('me/storage');
  const tone = data?.level === 'full' ? 'bg-destructive' : data?.level === 'warn' ? 'bg-amber-500' : 'bg-primary';
  return (
    <Link
      href={notesHref({ tab: 'mine' })}
      className="col-span-2 flex min-h-20 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 py-3 hover:bg-surface-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <FolderHeart className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">My Notes</span>
        <span className="block text-sm text-muted-foreground">
          {data ? `${formatBytes(data.usedBytes) || '0 B'} of ${formatBytes(data.limitBytes)} used` : 'Your own PDFs, photos, voice notes and more'}
        </span>
        {data && (
          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span className={cn('block h-full rounded-full', tone)} style={{ width: `${Math.max(data.percent, data.usedBytes > 0 ? 2 : 0)}%` }} />
          </span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function NotesHome({ myNotesEnabled, sharingEnabled }: { myNotesEnabled: boolean; sharingEnabled: boolean }) {
  const { data, error, loading, reload } = useNotesQuery<NotesHomePayload>('library/home');

  return (
    <PageFrame>
      <div className="mb-4 pt-2">
        <h1 className="font-display text-3xl font-black tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Short notes and formula sheets for quick revision.</p>
      </div>
      <SearchBox />

      {loading && !data ? (
        <div className="mt-6">
          <LoadingRows rows={3} />
        </div>
      ) : error ? (
        <div className="mt-6">
          <ErrorState message={error.message} onRetry={reload} />
        </div>
      ) : data ? (
        <div className="mt-6 space-y-7">
          {data.continueReading && (
            <section aria-labelledby="notes-continue">
              <h2 id="notes-continue" className="mb-2 text-sm font-semibold text-muted-foreground">
                Continue reading
              </h2>
              <ItemRow
                item={data.continueReading}
                href={notesHref({ note: data.continueReading.id })}
                subtitle={data.continueReading.breadcrumb.map((crumb) => crumb.name).join(' › ')}
              />
            </section>
          )}

          <section aria-labelledby="notes-library">
            <h2 id="notes-library" className="mb-2 text-sm font-semibold text-muted-foreground">
              Library
            </h2>
            {data.classes.length === 0 ? (
              <EmptyState
                title="Notes are on their way"
                body="Chapter-wise short notes and formula sheets will appear here soon."
                action={<PrimaryLink href="/ogcode">Practise questions meanwhile</PrimaryLink>}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.classes.map((folder) => (
                  <Link
                    key={folder.id}
                    href={notesHref({ folder: folder.id })}
                    className={cn(
                      'flex min-h-28 flex-col justify-between rounded-[18px] border border-border/60 bg-surface-1 p-4 transition-colors hover:bg-surface-2',
                      folder.kind === 'class' && folder.classLevel === data.ownClassLevel && 'border-primary/60',
                    )}
                  >
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', subjectTone(folder.subject))}>
                      <BookOpenCheck className="h-5 w-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-display text-xl font-bold leading-tight">{folder.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {folder.kind === 'class'
                          ? `${folder.folderCount} subject${folder.folderCount === 1 ? '' : 's'}`
                          : `${folder.noteCount + folder.folderCount} inside`}
                        {folder.kind === 'class' && folder.classLevel === data.ownClassLevel ? ' · Your class' : ''}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="notes-yours">
            <h2 id="notes-yours" className="mb-2 text-sm font-semibold text-muted-foreground">
              Yours
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {myNotesEnabled && <MyNotesCard />}
              {sharingEnabled && <SharedWithMeCard />}
              <Link
                href={notesHref({ tab: 'starred' })}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 hover:bg-surface-2"
              >
                <Star className="h-5 w-5 text-amber-500" aria-hidden />
                <span>
                  <span className="block text-[15px] font-semibold">Starred</span>
                  <span className="text-sm text-muted-foreground">{data.starredCount}</span>
                </span>
              </Link>
              <Link
                href={notesHref({ tab: 'recent' })}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-surface-1 px-3 hover:bg-surface-2"
              >
                <Clock3 className="h-5 w-5 text-primary" aria-hidden />
                <span>
                  <span className="block text-[15px] font-semibold">Recent</span>
                  <span className="text-sm text-muted-foreground">Last opened</span>
                </span>
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

function NotesList({ tab }: { tab: 'starred' | 'recent' }) {
  const { data, error, loading, reload, setData } = useNotesQuery<{ items: NotesSearchHit[] }>(tab === 'starred' ? 'me/starred' : 'me/recent');
  const items = data?.items ?? null;
  const toggle = useStarToggle(items, (next) => setData({ items: tab === 'starred' ? next.filter((i) => i.starred) : next }));
  const title = tab === 'starred' ? 'Starred' : 'Recent';
  return (
    <PageFrame>
      <TopBar backHref="/notes" backLabel="Back to Notes" title={title} />
      {loading && !data ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : items && items.length === 0 ? (
        <EmptyState
          title={tab === 'starred' ? 'No starred notes yet' : 'Nothing opened yet'}
          body={tab === 'starred' ? 'Tap the star on any note to keep it here for quick revision.' : 'Notes you open will show up here.'}
          action={<PrimaryLink href="/notes">Browse notes</PrimaryLink>}
        />
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              href={notesHref({ note: item.id })}
              subtitle={item.breadcrumb.map((crumb) => crumb.name).join(' › ')}
              onToggleStar={toggle}
            />
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function NotesSearch({ q }: { q: string }) {
  const { data, error, loading, reload } = useNotesQuery<{ hits: NotesSearchHit[] }>(`library/search?q=${encodeURIComponent(q)}`);
  return (
    <PageFrame>
      <TopBar
        backHref="/notes"
        backLabel="Back to Notes"
        title="Search"
        actions={
          <Link href="/notes" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Clear search">
            <X className="h-5 w-5" />
          </Link>
        }
      />
      <SearchBox key={q} initial={q} />
      <div className="mt-4">
        {loading && !data ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data && data.hits.length === 0 ? (
          <EmptyState title={`Nothing found for "${q}"`} body="Try a chapter name or a shorter word, like “projectile” or “mole”." />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {data?.hits.length ?? 0} result{data?.hits.length === 1 ? '' : 's'}
            </p>
            {(data?.hits ?? []).map((hit) => (
              <ItemRow
                key={hit.id}
                item={hit}
                href={notesHref({ note: hit.id })}
                subtitle={hit.snippet ?? hit.breadcrumb.map((crumb) => crumb.name).join(' › ')}
              />
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export default function NotesApp({ myNotesEnabled = false, sharingEnabled = false }: { myNotesEnabled?: boolean; sharingEnabled?: boolean }) {
  const params = useSearchParams();
  const note = params.get('n');
  const folder = params.get('f');
  const tab = params.get('tab');
  const q = params.get('q');
  const myFolder = params.get('mf');
  const myFile = params.get('file');
  const myQ = params.get('mq');
  const share = params.get('share');
  const sharedFolder = params.get('sf');
  const sharedFile = params.get('sfile');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [note, folder, tab, q, myFolder, myFile, myQ, share, sharedFolder, sharedFile]);

  if (myNotesEnabled && tab === 'mine') {
    if (myFile) return <MyFileView key={myFile} fileId={myFile} sharingEnabled={sharingEnabled} />;
    if (myQ) return <MySearchView q={myQ} />;
    return <MyNotesView key={myFolder ?? 'root'} folderId={myFolder} />;
  }
  if (myNotesEnabled && tab === 'bin') return <MyBinView />;
  if (sharingEnabled && tab === 'shared') {
    if (share && sharedFile) return <SharedFileView key={`${share}:${sharedFile}`} shareId={share} fileId={sharedFile} />;
    if (share) return <SharedFolderView key={`${share}:${sharedFolder ?? ''}`} shareId={share} folderId={sharedFolder} />;
    return <SharedWithMeView />;
  }

  if (note) return <NotesReader key={note} itemId={note} />;
  if (q) return <NotesSearch q={q} />;
  if (tab === 'starred' || tab === 'recent') return <NotesList tab={tab} />;
  if (folder) return <NotesFolderView key={folder} folderId={folder} showAll={params.get('all') === '1'} />;
  return <NotesHome myNotesEnabled={myNotesEnabled} sharingEnabled={sharingEnabled} />;
}
