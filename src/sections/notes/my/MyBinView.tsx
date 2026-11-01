'use client';

/**
 * My Notes (student) — the Bin: restore, remove for good, or empty it.
 * Items here still count against storage until they go (V1/NOTES_PLAN.md §3, §8).
 */

import { useState } from 'react';
import { Folder, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/notes/rules';
import type { MyBinEntry, MyBinPayload } from '@/lib/notes/my-types';

import { notesHref, notesSend, useNotesQuery } from '../notes-client';
import { EmptyState, ErrorState, LoadingRows, PageFrame, TopBar } from '../notes-ui';
import { ConfirmDialog, formatDayIST, kindMeta, StorageBar } from './my-ui';

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function MyBinView() {
  const { data, error, loading, reload } = useNotesQuery<MyBinPayload>('me/bin');
  const [confirm, setConfirm] = useState<null | { kind: 'purge'; entry: MyBinEntry } | { kind: 'empty' }>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const restore = async (entry: MyBinEntry) => {
    setBusyId(entry.id);
    try {
      await notesSend(`me/bin/${encodeURIComponent(entry.id)}/restore`, 'POST');
      toast.success(`Restored “${entry.title}”`);
      reload();
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not restore. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageFrame>
      <TopBar backHref={notesHref({ tab: 'mine' })} backLabel="Back to My Notes" title="Bin" />
      {loading && !data ? (
        <LoadingRows />
      ) : error || !data ? (
        <ErrorState message={error?.message ?? 'Could not load the Bin.'} onRetry={reload} />
      ) : (
        <div className="space-y-4">
          <StorageBar storage={data.storage} compact />
          <p className="text-sm text-muted-foreground">
            Deleted items stay here for {data.storage.binDays} days, then go for good. They still count towards your storage until then.
          </p>
          {data.entries.length === 0 ? (
            <EmptyState title="The Bin is empty" body="Things you delete from My Notes show up here." />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirm({ kind: 'empty' })}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-destructive/50 px-5 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Empty the Bin ({formatBytes(data.entries.reduce((sum, e) => sum + e.bytes, 0)) || '0 B'})
              </button>
              <ul className="space-y-2">
                {data.entries.map((entry) => {
                  const meta = entry.type === 'folder' ? null : kindMeta(entry.kind ?? 'pdf');
                  const Icon = meta?.Icon ?? Folder;
                  const left = daysLeft(entry.expiresAt);
                  return (
                    <li key={entry.id} className="flex min-h-16 items-center gap-2 rounded-2xl border border-border/60 bg-surface-1 px-3 py-2">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta?.tone ?? 'bg-primary/12 text-primary')}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{entry.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {[entry.type === 'folder' ? `Folder · ${entry.itemCount} file${entry.itemCount === 1 ? '' : 's'}` : null, entry.bytes > 0 ? formatBytes(entry.bytes) : null]
                            .filter(Boolean)
                            .join(' · ') || 'Empty'}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          Deleted {formatDayIST(entry.deletedAt)} · {left <= 1 ? 'goes tomorrow' : `${left} days left`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => restore(entry)}
                        disabled={busyId === entry.id}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-50"
                        aria-label={`Restore ${entry.title}`}
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'purge', entry })}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${entry.title} for good`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {confirm?.kind === 'purge' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Delete “${confirm.entry.title}” for good?`}
          body="This can't be undone. The space comes back straight away."
          confirmLabel="Delete for good"
          danger
          onConfirm={async () => {
            await notesSend(`me/bin/${encodeURIComponent(confirm.entry.id)}`, 'DELETE');
            toast.success('Deleted for good');
            reload();
          }}
        />
      )}
      {confirm?.kind === 'empty' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title="Empty the Bin?"
          body="Everything in the Bin is deleted for good. This can't be undone."
          confirmLabel="Empty the Bin"
          danger
          onConfirm={async () => {
            await notesSend('me/bin', 'DELETE');
            toast.success('The Bin is empty');
            reload();
          }}
        />
      )}
    </PageFrame>
  );
}
