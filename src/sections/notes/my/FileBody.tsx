'use client';

/**
 * My Notes — shows one uploaded file: PDFs (pdf.js), photos (full screen with
 * zoom), voice notes (speed 1×/1.5×/2×), videos, and Word/PowerPoint
 * (download only — phones can't preview them). Used for my own files and for
 * files a friend shared with me; typed notes are drawn by the caller.
 */

import { useRef, useState } from 'react';
import { Download } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MyFileCard } from '@/lib/notes/my-types';
import { PdfViewer } from '@/components/notes/PdfViewer';
import { ImageViewer } from '@/components/notes/ImageViewer';

import { EmptyState } from '../notes-ui';

const SPEEDS = [1, 1.5, 2] as const;

function AudioPlayer({ src, title }: { src: string; title: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const pick = (value: (typeof SPEEDS)[number]) => {
    setSpeed(value);
    if (audio.current) audio.current.playbackRate = value;
  };
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-surface-1 p-4">
      <audio ref={audio} controls preload="metadata" src={src} className="w-full" aria-label={title} onLoadedMetadata={(event) => (event.currentTarget.playbackRate = speed)} />
      <div className="flex items-center gap-2" role="group" aria-label="Playback speed">
        <span className="text-sm text-muted-foreground">Speed</span>
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            aria-pressed={speed === value}
            className={cn('inline-flex h-11 min-w-14 items-center justify-center rounded-full border px-3 text-sm font-semibold', speed === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-surface-2')}
          >
            {value}×
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * `fileHref` is the API path that redirects to the stored file (add
 * `?download=1` to download); `resolvePdfUrl` returns a signed link for pdf.js.
 */
export function FileBody({ file, fileHref, resolvePdfUrl }: { file: MyFileCard; fileHref: string; resolvePdfUrl: () => Promise<string> }) {
  const downloadHref = `${fileHref}?download=1`;
  if (file.kind === 'pdf') return <PdfViewer resolveUrl={resolvePdfUrl} downloadHref={downloadHref} />;
  if (file.kind === 'image') return <ImageViewer src={fileHref} alt={file.title} />;
  if (file.kind === 'audio') return <AudioPlayer src={fileHref} title={file.title} />;
  if (file.kind === 'video') return <video controls playsInline preload="metadata" src={fileHref} className="w-full rounded-2xl bg-black" aria-label={file.title} />;
  return (
    <EmptyState
      title="Open this file in another app"
      body="Word and PowerPoint files can't be shown inside Origin. Download it and open it with Word, PowerPoint or Google Docs."
      action={
        <a href={downloadHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          <Download className="h-4 w-4" aria-hidden /> Download
        </a>
      }
    />
  );
}
