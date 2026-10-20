'use client';

/**
 * Admin Notes → Import: bring in note files (.md) written outside the app, e.g.
 * the chapter notes Claude writes (V1/NOTES_PLAN.md §13). Always a preview
 * first; everything lands as a draft.
 */

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

import { adminNotes, errorMessage } from './admin-notes-api';
import { Btn, ErrorLine, Panel } from './admin-ui';

type Issue = { line: number | null; message: string };
type Result = {
  name: string;
  key: string | null;
  title: string | null;
  folderPath: string | null;
  action: 'create' | 'update' | 'unchanged' | 'conflict' | 'error';
  message: string | null;
  errors: Issue[];
  warnings: Issue[];
};

const ACTION_STYLE: Record<Result['action'], { label: string; className: string }> = {
  create: { label: 'New', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  update: { label: 'Update', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  unchanged: { label: 'No change', className: 'bg-surface-3 text-muted-foreground' },
  conflict: { label: 'Skipped', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  error: { label: 'Fix first', className: 'bg-destructive/15 text-destructive' },
};

export function ImportPanel() {
  const [files, setFiles] = useState<Array<{ name: string; text: string }>>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (list: FileList | null) => {
    setError(null);
    setResults(null);
    setApplied(false);
    const picked = Array.from(list ?? []).filter((file) => /\.(md|markdown|txt)$/iu.test(file.name));
    const read = await Promise.all(picked.map(async (file) => ({ name: file.name, text: await file.text() })));
    setFiles(read);
    if (read.length > 0) await preview(read);
  };

  const preview = async (batch = files) => {
    setBusy('preview');
    setError(null);
    try {
      const response = await adminNotes<{ results: Result[] }>('import/preview', { method: 'POST', body: { files: batch } });
      setResults(response.results);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy('apply');
    setError(null);
    try {
      const response = await adminNotes<{ results: Result[] }>('import/apply', { method: 'POST', body: { files } });
      setResults(response.results);
      setApplied(true);
      const created = response.results.filter((r) => r.action === 'create').length;
      const updated = response.results.filter((r) => r.action === 'update').length;
      toast.success(`Imported: ${created} new, ${updated} updated — all as drafts`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const ready = (results ?? []).filter((r) => r.action === 'create' || r.action === 'update').length;

  return (
    <div className="space-y-4">
      <Panel title="Import note files">
        <p className="mb-3 text-sm text-muted-foreground">
          Pick one or more <code>.md</code> files. Each needs a header with <code>title</code>, <code>type</code> and{' '}
          <code>chapter</code> (a standard folder key such as <code>c11.physics.motion-in-a-plane</code>). You see a preview first;
          imported notes are drafts until a teacher checks them and you publish.
        </p>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
          <FileUp className="h-4 w-4" aria-hidden /> Choose files
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple className="hidden" onChange={(e) => void pick(e.target.files)} />
        </label>
        {files.length > 0 && <span className="ml-3 text-sm text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} selected</span>}
        <div className="mt-3">
          <ErrorLine message={error} />
        </div>
      </Panel>

      {results && (
        <Panel
          title={applied ? 'Import result' : 'Preview'}
          actions={
            !applied && (
              <>
                <Btn onClick={() => void preview()} busy={busy === 'preview'}>Check again</Btn>
                <Btn tone="primary" onClick={apply} busy={busy === 'apply'} disabled={ready === 0}>
                  Import {ready} note{ready === 1 ? '' : 's'}
                </Btn>
              </>
            )
          }
        >
          <ul className="divide-y divide-border">
            {results.map((result) => (
              <li key={result.name} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ACTION_STYLE[result.action].className)}>{ACTION_STYLE[result.action].label}</span>
                  <span className="text-sm font-semibold">{result.title ?? result.name}</span>
                  <span className="text-xs text-muted-foreground">{result.name}</span>
                </div>
                {result.folderPath && <p className="mt-0.5 text-xs text-muted-foreground">→ {result.folderPath}</p>}
                {result.message && <p className="mt-1 text-sm">{result.message}</p>}
                {result.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm text-destructive">
                    {result.errors.map((issue, i) => (
                      <li key={i}>{issue.line ? `Line ${issue.line}: ` : ''}{issue.message}</li>
                    ))}
                  </ul>
                )}
                {result.warnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm text-amber-700 dark:text-amber-300">
                    {result.warnings.map((issue, i) => (
                      <li key={i}>{issue.line ? `Line ${issue.line}: ` : ''}{issue.message}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
