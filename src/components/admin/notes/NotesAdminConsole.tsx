'use client';

/**
 * /admin/notes — Origin Notes library console (V1/NOTES_PLAN.md §4).
 * Tabs live in `?tab=`; the Library tab also reads `?folder=` and `?item=`.
 * Not behind the student `notes` flag: the library is built before launch.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

import { ChecksPanel } from './ChecksPanel';
import { ImportPanel } from './ImportPanel';
import { LibraryPanel } from './LibraryPanel';
import { NoteEditor } from './NoteEditor';
import { BinPanel, CoveragePanel, ReportsPanel } from './OverviewPanels';
import { SharedReportsPanel } from './SharedReportsPanel';
import { SettingsPanel, StoragePanel } from './StoragePanels';
import { adminNotesHref } from './admin-notes-api';

const TABS = [
  { id: 'library', label: 'Library' },
  { id: 'import', label: 'Import' },
  { id: 'reports', label: 'Reports' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'bin', label: 'Bin' },
  { id: 'storage', label: 'Storage' },
  { id: 'settings', label: 'Settings' },
  { id: 'checks', label: 'Checks' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function safeId(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{1,120}$/u.test(value) ? value : null;
}

export default function NotesAdminConsole({ studentLaunch }: { studentLaunch: boolean }) {
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'library';
  // Ids go into API paths, so anything that isn't a plain id (e.g. "../users") is ignored.
  const folder = safeId(params.get('folder'));
  const item = safeId(params.get('item'));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">
            The shared notes library.{' '}
            {studentLaunch ? 'Students can see published notes.' : 'Students can’t see Notes yet (TEACHER_LAUNCH_NOTES is off), so you can build it first.'}
          </p>
        </div>
      </div>

      <nav aria-label="Notes sections" className="flex flex-wrap gap-1 rounded-full border border-border bg-surface-1 p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={adminNotesHref({ tab: t.id })}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'library' && (item ? <NoteEditor key={item} itemId={item} /> : <LibraryPanel folderId={folder} />)}
      {tab === 'import' && <ImportPanel />}
      {tab === 'reports' && (
        <div className="space-y-4">
          <ReportsPanel />
          <SharedReportsPanel />
        </div>
      )}
      {tab === 'coverage' && <CoveragePanel />}
      {tab === 'bin' && <BinPanel />}
      {tab === 'storage' && <StoragePanel />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'checks' && <ChecksPanel />}
    </div>
  );
}
