'use client';

/**
 * Photo of a note page: fits the screen, tap to open full screen with zoom.
 * Zoom is plain scaling inside a scrollable frame, so panning is ordinary
 * scrolling (works the same with a finger, a mouse wheel or a keyboard).
 */

import { useEffect, useState } from 'react';
import { Maximize2, Minus, Plus, X } from 'lucide-react';

const ZOOMS = [1, 1.5, 2, 3, 4];

export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (failed) {
    return (
      <div className="rounded-2xl border border-border bg-surface-1 px-4 py-10 text-center text-sm text-muted-foreground">
        This photo couldn&apos;t be loaded. Check your connection and open it again.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoomIndex(0);
          setOpen(true);
        }}
        className="group relative block w-full overflow-hidden rounded-2xl border border-border bg-white"
        aria-label={`Open ${alt} full screen`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="mx-auto block max-h-[75vh] w-auto max-w-full" onError={() => setFailed(true)} />
        <span className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
          <Maximize2 className="h-5 w-5" aria-hidden />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt}>
          <div className="flex items-center justify-between gap-2 px-2 py-2 text-white safe-top">
            <button type="button" onClick={() => setOpen(false)} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close">
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                disabled={zoomIndex === 0}
                className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
                aria-label="Zoom out"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="w-12 text-center text-sm tabular-nums">{ZOOMS[zoomIndex] * 100}%</span>
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
                disabled={zoomIndex === ZOOMS.length - 1}
                className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
                aria-label="Zoom in"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto" onDoubleClick={() => setZoomIndex((i) => (i === 0 ? 2 : 0))}>
            <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: `${ZOOMS[zoomIndex] * 100}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} className="block h-auto w-full max-w-none select-none" draggable={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
