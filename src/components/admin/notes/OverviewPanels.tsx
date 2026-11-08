'use client';

/** Admin Notes → Reports, Coverage and Bin tabs (V1/NOTES_PLAN.md §4). */

import Link from 'next/link';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { NotesCrumb, NotesReportReason } from '@/lib/notes/types';

import { adminNotes, adminNotesHref, errorMessage, useAdminNotes } from './admin-notes-api';
import { Btn, ErrorLine, Panel, formatWhen } from './admin-ui';

type Report = {
  id: string;
  reason: NotesReportReason;
  message: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  reporterName: string | null;
  itemId: string;
  itemTitle: string | null;
  breadcrumb: NotesCrumb[];
  resolutionNote: string | null;
  resolvedAt: string | null;
};

const REASONS: Record<NotesReportReason, string> = {
  mistake: 'Mistake',
  unclear: 'Hard to understand',
  broken: "Doesn't open",
  other: 'Other',
};

export function ReportsPanel() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const { data, error, loading, reload } = useAdminNotes<{ reports: Report[] }>(`reports?status=${status}`);

  const resolve = async (report: Report, next: 'resolved' | 'dismissed') => {
    const note = window.prompt(next === 'resolved' ? 'What did you fix? (optional)' : 'Why dismiss it? (optional)') ?? null;
    try {
      await adminNotes(`reports/${report.id}/resolve`, { method: 'POST', body: { status: next, note } });
      toast.success(next === 'resolved' ? 'Marked as fixed' : 'Dismissed');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Panel
      title="Reports on library notes"
      actions={
        <>
          <Btn tone={status === 'open' ? 'primary' : 'secondary'} onClick={() => setStatus('open')}>Open</Btn>
          <Btn tone={status === 'closed' ? 'primary' : 'secondary'} onClick={() => setStatus('closed')}>Closed</Btn>
        </>
      }
    >
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorLine message={error} />
      ) : (data?.reports ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{status === 'open' ? 'No open reports.' : 'Nothing closed yet.'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {(data?.reports ?? []).map((report) => (
            <li key={report.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{REASONS[report.reason]}</span>
                  <Link
                    href={adminNotesHref({ folder: report.breadcrumb[report.breadcrumb.length - 1]?.id ?? null, item: report.itemId })}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {report.itemTitle ?? 'Deleted note'}
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">{report.breadcrumb.map((c) => c.name).join(' › ')}</p>
                {report.message && <p className="mt-1 text-sm">“{report.message}”</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.reporterName ?? 'A student'} · {formatWhen(report.createdAt)}
                  {report.resolutionNote ? ` · Note: ${report.resolutionNote}` : ''}
                </p>
              </div>
              {report.status === 'open' && (
                <div className="flex gap-2">
                  <Btn tone="primary" onClick={() => resolve(report, 'resolved')}>Mark fixed</Btn>
                  <Btn onClick={() => resolve(report, 'dismissed')}>Dismiss</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type Coverage = {
  subjects: Array<{
    folderId: string;
    classLevel: number | null;
    name: string;
    chapters: number;
    chaptersWithNotes: number;
    published: number;
    inReview: number;
    draft: number;
    visible: boolean;
  }>;
  topViewed: Array<{ itemId: string; title: string; views: number; students: number; breadcrumb: NotesCrumb[] }>;
  openReports: number;
  unlinkedChapters: number;
};

export function CoveragePanel() {
  const { data, error, loading } = useAdminNotes<Coverage>('coverage');
  if (loading && !data) return <Panel><p className="text-sm text-muted-foreground">Loading…</p></Panel>;
  if (error || !data) return <Panel><ErrorLine message={error ?? 'Could not load coverage.'} /></Panel>;
  const totals = data.subjects.reduce(
    (sum, row) => ({ chapters: sum.chapters + row.chapters, done: sum.done + row.chaptersWithNotes, review: sum.review + row.inReview }),
    { chapters: 0, done: 0, review: 0 },
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Chapters with notes', value: `${totals.done} / ${totals.chapters}` },
          { label: 'Waiting for review', value: totals.review },
          { label: 'Open reports', value: data.openReports },
          { label: 'Chapters not linked to practice', value: data.unlinkedChapters },
        ].map((stat) => (
          <Panel key={stat.label}>
            <p className="font-display text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </Panel>
        ))}
      </div>

      <Panel title="By subject">
        {data.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subject folders yet. Use &ldquo;Create standard folders&rdquo; in the Library tab.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">Chapters with notes</th>
                  <th className="py-2 pr-3 font-medium">Published</th>
                  <th className="py-2 pr-3 font-medium">In review</th>
                  <th className="py-2 pr-3 font-medium">Drafts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.subjects.map((row) => {
                  const percent = row.chapters ? Math.round((row.chaptersWithNotes / row.chapters) * 100) : 0;
                  return (
                    <tr key={row.folderId}>
                      <td className="py-2 pr-3">
                        <Link href={adminNotesHref({ folder: row.folderId })} className="font-semibold hover:text-primary">
                          {row.name}
                        </Link>
                        {!row.visible && <span className="ml-2 text-xs text-muted-foreground">(not visible yet)</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-3">
                            <div className={cn('h-full', percent === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${percent}%` }} />
                          </div>
                          <span className="tabular-nums">{row.chaptersWithNotes}/{row.chapters}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.published}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.inReview}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.draft}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Most read">
        {data.topViewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reads yet.</p>
        ) : (
          <ol className="space-y-2">
            {data.topViewed.map((row) => (
              <li key={row.itemId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.breadcrumb.map((c) => c.name).join(' › ')}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {row.views} reads · {row.students} students
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

type BinEntry = { type: 'folder' | 'item'; id: string; name: string; deletedAt: string; deletedByName: string | null; from: string };

export function BinPanel() {
  const { data, error, loading, reload } = useAdminNotes<{ entries: BinEntry[] }>('bin');
  const restore = async (entry: BinEntry) => {
    try {
      await adminNotes(`bin/${entry.type}/${entry.id}/restore`, { method: 'POST' });
      toast.success(`Restored "${entry.name}"`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Panel title="Bin">
      <p className="mb-3 text-sm text-muted-foreground">Deleted folders and notes. Students can&apos;t see them. Restore brings back a folder with everything that was deleted with it.</p>
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorLine message={error} />
      ) : (data?.entries ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">The Bin is empty.</p>
      ) : (
        <ul className="divide-y divide-border">
          {(data?.entries ?? []).map((entry) => (
            <li key={`${entry.type}-${entry.id}`} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.type === 'folder' ? 'Folder' : 'Note'} from {entry.from} · deleted {formatWhen(entry.deletedAt)}
                  {entry.deletedByName ? ` by ${entry.deletedByName}` : ''}
                </p>
              </div>
              <Btn onClick={() => restore(entry)}>
                <RotateCcw className="h-4 w-4" /> Restore
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
