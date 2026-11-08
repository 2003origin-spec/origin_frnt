'use client';

/**
 * Admin Notes → Storage and Settings tabs (V1/NOTES_PLAN.md §4).
 *
 * Storage: totals, the biggest users, and a lookup for one student — usage,
 * file names and sizes (never the files themselves), a personal limit with a
 * reason, and upload/sharing blocks. Settings: the limits and switches every
 * student gets. Every change is audited on the server.
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/notes/rules';
import { MB, GB, PERSONAL_UPLOAD_KINDS, type NotesSettings } from '@/lib/notes/storage-rules';
import type { NotesFileKind } from '@/lib/notes/file-types';

import { adminNotes, errorMessage, useAdminNotes } from './admin-notes-api';
import { Btn, ErrorLine, Field, Panel, formatWhen, inputClass } from './admin-ui';

type StorageUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  uploadsBlocked: boolean;
};

type StorageOverview = {
  totalUsedBytes: number;
  totalFiles: number;
  studentsWithFiles: number;
  byKind: { kind: string; files: number; bytes: number }[];
  topUsers: StorageUserRow[];
};

type StorageUserDetail = StorageUserRow & {
  reservedBytes: number;
  premium: boolean;
  limitOverrideBytes: number | null;
  overrideReason: string | null;
  sharingBlocked: boolean;
  blockReason: string | null;
  files: { id: string; title: string; kind: string; bytes: number; createdAt: string; inBin: boolean }[];
};

const KIND_LABELS: Record<string, string> = {
  typed: 'Typed notes',
  pdf: 'PDFs',
  image: 'Photos',
  office: 'Word / PowerPoint',
  audio: 'Voice notes and audio',
  video: 'Videos',
};

function usage(row: { usedBytes: number; limitBytes: number }): string {
  const percent = row.limitBytes > 0 ? Math.round((row.usedBytes / row.limitBytes) * 100) : 100;
  return `${formatBytes(row.usedBytes) || '0 B'} of ${formatBytes(row.limitBytes) || '0 B'} (${percent}%)`;
}

function UserList({ users, onPick }: { users: StorageUserRow[]; onPick: (id: string) => void }) {
  if (users.length === 0) return <p className="text-sm text-muted-foreground">No students found.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {users.map((user) => (
        <li key={user.userId}>
          <button type="button" onClick={() => onPick(user.userId)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name ?? 'No name'}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email ?? user.userId}</span>
            </span>
            <span className="text-sm">{usage(user)}</span>
            <span className="text-xs text-muted-foreground">{user.fileCount} files</span>
            {user.uploadsBlocked && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">Blocked</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, error, loading, setData } = useAdminNotes<StorageUserDetail>(`storage/users/${encodeURIComponent(userId)}`);
  const [limitMb, setLimitMb] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    setSaveError(null);
    try {
      setData(await adminNotes<StorageUserDetail>(`storage/users/${encodeURIComponent(userId)}`, { method: 'PUT', body: patch }));
      toast.success(done);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return <ErrorLine message={error ?? 'Could not load this student.'} />;

  const shownLimit = limitMb ?? (data.limitOverrideBytes !== null ? String(Math.round(data.limitOverrideBytes / MB)) : '');
  const setLimit = (event: FormEvent) => {
    event.preventDefault();
    const mb = Number(shownLimit);
    if (!Number.isFinite(mb) || mb < 0) {
      setSaveError('Type the limit in MB, for example 2048 for 2 GB.');
      return;
    }
    void save({ limitOverrideBytes: Math.round(mb * MB), overrideReason: reason }, 'Personal limit saved');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{data.name ?? 'No name'}</p>
          <p className="text-sm text-muted-foreground">{data.email ?? data.userId}</p>
        </div>
        <Btn onClick={onClose}>Back to the list</Btn>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-muted-foreground">Used</dt>
          <dd className="font-semibold">{usage(data)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-muted-foreground">Limit comes from</dt>
          <dd className="font-semibold">{data.limitOverrideBytes !== null ? `Personal limit (${data.overrideReason ?? 'no reason'})` : data.premium ? 'Premium limit' : 'Free limit'}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-muted-foreground">Uploading now</dt>
          <dd className="font-semibold">{formatBytes(data.reservedBytes) || 'Nothing'}</dd>
        </div>
      </dl>

      <form onSubmit={setLimit} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Field label="Personal limit (MB)" hint="Empty = use the free or premium limit.">
          <input inputMode="numeric" className={inputClass} value={shownLimit} onChange={(event) => setLimitMb(event.target.value)} />
        </Field>
        <Field label="Reason (required)">
          <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. topper, needs space for videos" />
        </Field>
        <div className="flex gap-2">
          <Btn tone="primary" type="submit" busy={busy} disabled={!shownLimit}>
            Save
          </Btn>
          {data.limitOverrideBytes !== null && (
            <Btn busy={busy} onClick={() => save({ limitOverrideBytes: null }, 'Personal limit removed')}>
              Clear
            </Btn>
          )}
        </div>
      </form>

      <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[2fr_auto_auto] sm:items-end">
        <Field label="Reason for a block" hint="The student sees this reason.">
          <input className={inputClass} value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder={data.blockReason ?? 'e.g. uploaded copyrighted videos'} />
        </Field>
        <Btn
          tone={data.uploadsBlocked ? 'secondary' : 'danger'}
          busy={busy}
          onClick={() => save({ uploadsBlocked: !data.uploadsBlocked, blockReason: blockReason || null }, data.uploadsBlocked ? 'Uploads allowed again' : 'Uploads blocked')}
        >
          {data.uploadsBlocked ? 'Allow uploads' : 'Block uploads'}
        </Btn>
        <Btn
          tone={data.sharingBlocked ? 'secondary' : 'danger'}
          busy={busy}
          onClick={() => save({ sharingBlocked: !data.sharingBlocked, blockReason: blockReason || null }, data.sharingBlocked ? 'Sharing allowed again' : 'Sharing blocked')}
        >
          {data.sharingBlocked ? 'Allow sharing' : 'Block sharing'}
        </Btn>
      </div>
      <ErrorLine message={saveError} />

      <div>
        <h3 className="mb-2 text-sm font-bold">Files ({data.files.length}, biggest first)</h3>
        <p className="mb-2 text-xs text-muted-foreground">Names and sizes only. Admins can&apos;t open a student&apos;s private files.</p>
        {data.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Size</th>
                  <th className="px-3 py-2 font-semibold">Added</th>
                </tr>
              </thead>
              <tbody>
                {data.files.map((file) => (
                  <tr key={file.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {file.title}
                      {file.inBin && <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-xs">In Bin</span>}
                    </td>
                    <td className="px-3 py-2">{KIND_LABELS[file.kind] ?? file.kind}</td>
                    <td className="px-3 py-2">{formatBytes(file.bytes) || '0 B'}</td>
                    <td className="px-3 py-2">{formatWhen(file.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StoragePanel() {
  const overview = useAdminNotes<StorageOverview>('storage/overview');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const search = useAdminNotes<{ users: StorageUserRow[] }>(submitted.length >= 2 ? `storage/users?q=${encodeURIComponent(submitted)}` : null);
  const [picked, setPicked] = useState<string | null>(null);

  if (picked) {
    return (
      <Panel title="Student storage">
        <UserDetail userId={picked} onClose={() => setPicked(null)} />
      </Panel>
    );
  }

  const data = overview.data;
  return (
    <div className="space-y-4">
      <Panel title="My Notes storage">
        {overview.loading && !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : overview.error || !data ? (
          <ErrorLine message={overview.error ?? 'Could not load storage.'} />
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted-foreground">Space used</dt>
                <dd className="text-lg font-bold">{formatBytes(data.totalUsedBytes) || '0 B'}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted-foreground">Files</dt>
                <dd className="text-lg font-bold">{data.totalFiles}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted-foreground">Students with files</dt>
                <dd className="text-lg font-bold">{data.studentsWithFiles}</dd>
              </div>
            </dl>
            {data.byKind.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {data.byKind.map((row) => (
                  <li key={row.kind} className="rounded-full bg-surface-2 px-3 py-1">
                    {KIND_LABELS[row.kind] ?? row.kind}: {row.files} · {formatBytes(row.bytes) || '0 B'}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <h3 className="mb-2 text-sm font-bold">Biggest users</h3>
              <UserList users={data.topUsers} onPick={setPicked} />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Look up a student">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query.trim());
          }}
          className="flex gap-2"
        >
          <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, phone, name or user id" aria-label="Find a student" />
          <Btn tone="primary" type="submit">
            Find
          </Btn>
        </form>
        <div className="mt-3">
          {search.loading ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : search.error ? (
            <ErrorLine message={search.error} />
          ) : search.data ? (
            <UserList users={search.data.users} onPick={setPicked} />
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function SettingsForm({ initial, onSaved }: { initial: NotesSettings; onSaved: (next: NotesSettings) => void }) {
  const [form, setForm] = useState(() => ({
    freeMb: String(Math.round(initial.freeLimitBytes / MB)),
    premiumMb: String(Math.round(initial.premiumLimitBytes / MB)),
    fileMb: String(Math.round(initial.maxFileBytes / MB)),
    videoMb: String(Math.round(initial.maxVideoBytes / MB)),
    binDays: String(initial.binDays),
    allowedKinds: initial.allowedKinds,
    uploadsEnabled: initial.uploadsEnabled,
    sharingEnabled: initial.sharingEnabled,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleKind = (kind: NotesFileKind) =>
    setForm((f) => ({ ...f, allowedKinds: f.allowedKinds.includes(kind) ? f.allowedKinds.filter((k) => k !== kind) : [...f.allowedKinds, kind] }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await adminNotes<NotesSettings>('settings', {
        method: 'PUT',
        body: {
          freeLimitBytes: Math.round(Number(form.freeMb) * MB),
          premiumLimitBytes: Math.round(Number(form.premiumMb) * MB),
          maxFileBytes: Math.round(Number(form.fileMb) * MB),
          maxVideoBytes: Math.round(Number(form.videoMb) * MB),
          binDays: Math.round(Number(form.binDays)),
          allowedKinds: form.allowedKinds,
          uploadsEnabled: form.uploadsEnabled,
          sharingEnabled: form.sharingEnabled,
        },
      });
      toast.success('Settings saved. Every server picks them up within a minute.');
      onSaved(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const number = (key: 'freeMb' | 'premiumMb' | 'fileMb' | 'videoMb' | 'binDays') => ({
    inputMode: 'numeric' as const,
    className: inputClass,
    value: form[key],
    onChange: (event: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: event.target.value })),
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Free students: storage (MB)" hint={`Now ${formatBytes(initial.freeLimitBytes)}. 1024 MB = 1 GB.`}>
          <input {...number('freeMb')} />
        </Field>
        <Field label="Premium students: storage (MB)" hint={`Now ${formatBytes(initial.premiumLimitBytes)}. Anyone who owns a premium subject.`}>
          <input {...number('premiumMb')} />
        </Field>
        <Field label="Largest file (MB)" hint="PDFs, photos, Word/PowerPoint and audio. 1–200 MB.">
          <input {...number('fileMb')} />
        </Field>
        <Field label="Largest video (MB)" hint="1–500 MB.">
          <input {...number('videoMb')} />
        </Field>
        <Field label="Days in the Bin" hint="Then deleted for good. 1–90.">
          <input {...number('binDays')} />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Allowed file types</legend>
        <div className="flex flex-wrap gap-2">
          {PERSONAL_UPLOAD_KINDS.map((kind) => (
            <label key={kind} className={cn('inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm', form.allowedKinds.includes(kind) ? 'border-primary bg-primary/10' : 'border-border')}>
              <input type="checkbox" checked={form.allowedKinds.includes(kind)} onChange={() => toggleKind(kind)} />
              {KIND_LABELS[kind]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Typed notes are always allowed.</p>
      </fieldset>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.uploadsEnabled} onChange={(event) => setForm((f) => ({ ...f, uploadsEnabled: event.target.checked }))} />
          Uploads on (turn off to stop all new uploads at once)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.sharingEnabled} onChange={(event) => setForm((f) => ({ ...f, sharingEnabled: event.target.checked }))} />
          Sharing on (used when sharing with friends launches)
        </label>
      </div>
      <ErrorLine message={error} />
      <Btn tone="primary" type="submit" busy={busy}>
        Save settings
      </Btn>
    </form>
  );
}

export function SettingsPanel() {
  const { data, error, loading, setData } = useAdminNotes<NotesSettings>('settings');
  return (
    <Panel title="My Notes settings">
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error || !data ? (
        <ErrorLine message={error ?? 'Could not load the settings.'} />
      ) : (
        <SettingsForm key={JSON.stringify(data)} initial={data} onSaved={setData} />
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Free limit default {formatBytes(100 * MB)}, premium {formatBytes(1 * GB)}. A student who drops from premium to free keeps their files but can&apos;t upload until they are under the free limit.
      </p>
    </Panel>
  );
}
