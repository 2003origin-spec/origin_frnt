'use client';

/**
 * My Notes uploads in the browser (V1/NOTES_PLAN.md §8): one file at a time,
 * so a phone on a slow connection isn't flooded.
 *
 *   shrink photos → ask for a ticket (space is reserved) → PUT with progress
 *   → "complete" (the server checks the real file) → done.
 *
 * If anything fails after the ticket, the ticket is cancelled so the reserved
 * space comes back at once instead of at the nightly cleanup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { NOTES_FILE_TYPES, normaliseMime } from '@/lib/notes/file-types';
import type { MyFileCard, MyUploadTicket } from '@/lib/notes/my-types';
import { PHOTO_MAX_SIDE } from '@/lib/notes/storage-rules';
import { mediaDuration, pdfPageCount, putWithProgress, shrinkPhoto } from '@/components/notes/upload-helpers';

import { notesSend } from '../notes-client';

export type UploadJob = {
  key: string;
  name: string;
  /** 0–1 while uploading. */
  progress: number;
  status: 'waiting' | 'preparing' | 'uploading' | 'checking' | 'done' | 'failed';
  error: string | null;
};

export type UploadRequest = { file: File; durationS?: number | null };

/** The browser's type, or one worked out from the extension (Android often sends none for .docx). */
export function mimeForFile(file: File): string {
  const reported = normaliseMime(file.type);
  if (NOTES_FILE_TYPES.some((type) => type.mime === reported)) return reported;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const match = NOTES_FILE_TYPES.find((type) => type.ext === ext || (type.aliases ?? []).includes(ext));
  return match?.mime ?? reported;
}

let counter = 0;

export function useMyUploads(onUploaded: (file: MyFileCard) => void) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const busy = useRef(false);
  const queue = useRef<{ key: string; request: UploadRequest; folderId: string | null }[]>([]);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const update = (key: string, patch: Partial<UploadJob>) =>
    setJobs((list) => list.map((job) => (job.key === key ? { ...job, ...patch } : job)));

  const runOne = async (key: string, request: UploadRequest, folderId: string | null) => {
    let ticket: MyUploadTicket | null = null;
    try {
      update(key, { status: 'preparing' });
      const file = request.file.type.startsWith('image/') ? await shrinkPhoto(request.file, PHOTO_MAX_SIDE) : request.file;
      const mime = mimeForFile(file);
      const [pageCount, measured] = await Promise.all([
        mime === 'application/pdf' ? pdfPageCount(file) : Promise.resolve(null),
        request.durationS ? Promise.resolve(request.durationS) : mediaDuration(file),
      ]);
      ticket = await notesSend<MyUploadTicket>('me/uploads', 'POST', { folderId, fileName: file.name, mime, bytes: file.size });
      update(key, { status: 'uploading', progress: 0 });
      await putWithProgress(ticket.uploadUrl, file, ticket.headers, (fraction) => update(key, { progress: fraction }));
      update(key, { status: 'checking', progress: 1 });
      const saved = await notesSend<MyFileCard>(`me/uploads/${encodeURIComponent(ticket.uploadId)}/complete`, 'POST', {
        pageCount,
        durationS: measured,
      });
      update(key, { status: 'done' });
      onUploadedRef.current(saved);
    } catch (error) {
      if (ticket) void notesSend(`me/uploads/${encodeURIComponent(ticket.uploadId)}`, 'DELETE').catch(() => undefined);
      update(key, { status: 'failed', error: (error as { message?: string }).message ?? 'Upload failed. Try again.' });
    }
  };

  const pump = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (let next = queue.current.shift(); next; next = queue.current.shift()) {
        await runOne(next.key, next.request, next.folderId);
      }
    } finally {
      busy.current = false;
    }
  };

  const start = (requests: UploadRequest[], folderId: string | null) => {
    const added = requests.map((request) => {
      counter += 1;
      return { key: `u${counter}`, request, folderId };
    });
    queue.current.push(...added);
    setJobs((list) => [
      ...list.filter((job) => job.status !== 'done'),
      ...added.map((entry): UploadJob => ({ key: entry.key, name: entry.request.file.name, progress: 0, status: 'waiting', error: null })),
    ]);
    void pump();
  };

  const dismiss = useCallback((key: string) => setJobs((list) => list.filter((job) => job.key !== key)), []);

  return { jobs, start, dismiss };
}
