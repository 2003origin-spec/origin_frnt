'use client';

/**
 * Admin Notes → Reports → "Shared by students": reports about files a student
 * shared with friends (V1/NOTES_PLAN.md §9 "Safety"). Open the file (audited),
 * remove it for good, block the owner from sharing, or dismiss.
 */

import { useState } from 'react';
import { toast } from 'sonner';

import type { MyFileKind } from '@/lib/notes/storage-rules';
import type { SharedReportReason } from '@/lib/notes/types';
import { formatBytes } from '@/lib/notes/rules';
import { NotesMarkdown } from '@/components/notes/NotesMarkdown';

import { adminNotes, errorMessage, useAdminNotes } from './admin-notes-api';
import { Btn, ErrorLine, Modal, Panel, formatWhen } from './admin-ui';

type SharedReport = {
  id: string;
  reason: SharedReportReason;
  message: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  reporterName: string | null;
  fileId: string;
  file: { title: string; kind: MyFileKind; bytes: number; inBin: boolean } | null;
  owner: { id: string; name: string; username: string | null; sharingBlocked: boolean } | null;
  openReportsOnFile: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
};

const REASONS: Record<SharedReportReason, string> = {
  inappropriate: 'Not appropriate',
  copyright: 'Copyright',
  spam: 'Spam',
  other: 'Other',
};

export function SharedReportsPanel() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const { data, error, loading, reload } = useAdminNotes<{ reports: SharedReport[] }>(`shared-reports?status=${status}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [typed, setTyped] = useState<{ title: string; bodyMd: string } | null>(null);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    try {
      await work();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const open = (report: SharedReport) =>
    run(`open:${report.id}`, async () => {
      const result = await adminNotes<{ title: string; bodyMd: string | null; url: string | null }>(`shared-reports/${report.id}/open`, { method: 'POST' });
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
      else setTyped({ title: result.title, bodyMd: result.bodyMd ?? '' });
    });

  const remove = (report: SharedReport) => {
    if (!window.confirm(`Remove “${report.file?.title ?? 'this file'}” for good? Friends lose access, the owner is told, and it can't be undone.`)) return;
    const note = window.prompt('Why? (optional, kept in the report)') ?? null;
    return run(`remove:${report.id}`, async () => {
      await adminNotes(`shared-reports/${report.id}/remove`, { method: 'POST', body: { note } });
      toast.success('File removed');
      reload();
    });
  };

  const block = (report: SharedReport) => {
    if (!report.owner) return;
    const reason = window.prompt(`Why block ${report.owner.name} from sharing? The student sees this.`);
    if (!reason?.trim()) return;
    const ownerId = report.owner.id;
    return run(`block:${report.id}`, async () => {
      await adminNotes(`storage/users/${encodeURIComponent(ownerId)}`, { method: 'PUT', body: { sharingBlocked: true, blockReason: reason.trim() } });
      toast.success('Sharing blocked. Everything they shared is hidden now.');
      reload();
    });
  };

  const close = (report: SharedReport, next: 'resolved' | 'dismissed') => {
    const note = window.prompt(next === 'resolved' ? 'What did you do? (optional)' : 'Why dismiss it? (optional)') ?? null;
    return run(`close:${report.id}`, async () => {
      await adminNotes(`reports/${report.id}/resolve`, { method: 'POST', body: { status: next, note } });
      toast.success(next === 'resolved' ? 'Marked as handled' : 'Dismissed');
      reload();
    });
  };

  return (
    <Panel
      title="Shared by students"
      actions={
        <>
          <Btn tone={status === 'open' ? 'primary' : 'secondary'} onClick={() => setStatus('open')}>Open</Btn>
          <Btn tone={status === 'closed' ? 'primary' : 'secondary'} onClick={() => setStatus('closed')}>Closed</Btn>
        </>
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Files students shared with friends that a friend reported. Opening a file is logged, because it is a student&apos;s private file.
      </p>
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
                  <span className="text-sm font-semibold">{report.file?.title ?? 'Removed file'}</span>
                  {report.file?.inBin && <span className="text-xs text-muted-foreground">(in the owner&apos;s Bin)</span>}
                  {report.openReportsOnFile > 1 && <span className="text-xs font-semibold text-destructive">{report.openReportsOnFile} open reports</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner: {report.owner ? `${report.owner.name}${report.owner.username ? ` (@${report.owner.username})` : ''}` : 'unknown'}
                  {report.owner?.sharingBlocked ? ' · sharing blocked' : ''}
                  {report.file ? ` · ${report.file.kind}${report.file.bytes ? `, ${formatBytes(report.file.bytes)}` : ''}` : ''}
                </p>
                {report.message && <p className="mt-1 text-sm">“{report.message}”</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.reporterName ?? 'A student'} · {formatWhen(report.createdAt)}
                  {report.resolutionNote ? ` · Note: ${report.resolutionNote}` : ''}
                </p>
              </div>
              {report.status === 'open' && (
                <div className="flex flex-wrap gap-2">
                  {report.file && <Btn busy={busy === `open:${report.id}`} onClick={() => open(report)}>Open file</Btn>}
                  {report.file && <Btn tone="danger" busy={busy === `remove:${report.id}`} onClick={() => remove(report)}>Remove file</Btn>}
                  {report.owner && !report.owner.sharingBlocked && (
                    <Btn tone="danger" busy={busy === `block:${report.id}`} onClick={() => block(report)}>Block sharing</Btn>
                  )}
                  <Btn busy={busy === `close:${report.id}`} onClick={() => close(report, 'dismissed')}>Dismiss</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={typed !== null} onOpenChange={(next) => !next && setTyped(null)} title={typed?.title ?? ''} wide>
        {typed && (typed.bodyMd.trim() ? <NotesMarkdown markdown={typed.bodyMd} look="clean" remoteImages={false} /> : <p className="text-sm text-muted-foreground">This note is empty.</p>)}
      </Modal>
    </Panel>
  );
}
