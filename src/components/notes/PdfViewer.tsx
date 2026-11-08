'use client';

/**
 * In-app PDF viewer on pdf.js (V1/NOTES_PLAN.md §3). The Android app's WebView
 * has no built-in PDF viewer (an <iframe> PDF shows nothing there), so Notes
 * draws pages itself.
 *
 * - The LEGACY build: the app supports WebView 111+, and the modern build
 *   needs newer APIs (e.g. Promise.withResolvers, Chrome 119).
 * - Pages render only when they scroll near the screen, at the device pixel
 *   ratio (capped at 2) so text stays sharp without using too much memory.
 * - `resolveUrl` returns a short-lived signed link; pdf.js fetches it straight
 *   from storage (the bucket's CORS rules allow the site's origins).
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function PdfPage({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [ratio, setRatio] = useState(1.414);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const viewport = page.getViewport({ scale: width / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const render = page.render({
          canvas,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        task = render;
        await render.promise;
      } catch (error) {
        const name = (error as { name?: string })?.name;
        if (!cancelled && name !== 'RenderingCancelledException') setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, near, pageNumber, width]);

  return (
    <div
      ref={holderRef}
      className="relative mx-auto overflow-hidden rounded-md bg-white shadow-sm"
      style={{ width, height: Math.round(width * ratio) }}
      aria-label={`Page ${pageNumber}`}
    >
      <canvas ref={canvasRef} className="block" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">This page couldn&apos;t be shown.</div>
      )}
    </div>
  );
}

export function PdfViewer({
  resolveUrl,
  downloadHref,
  onPageCount,
}: {
  resolveUrl: () => Promise<string>;
  downloadHref?: string | null;
  onPageCount?: (pages: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const resolveRef = useRef(resolveUrl);
  const pageCountRef = useRef(onPageCount);
  // Latest callbacks without restarting the load (declared first so it runs first).
  useEffect(() => {
    resolveRef.current = resolveUrl;
    pageCountRef.current = onPageCount;
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(Math.floor(entry.contentRect.width)));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    void (async () => {
      try {
        const [pdfjs, url] = await Promise.all([loadPdfJs(), resolveRef.current()]);
        if (cancelled) return;
        const task = pdfjs.getDocument({ url, enableXfa: false });
        destroy = () => void task.destroy();
        const loaded = await task.promise;
        if (cancelled) return;
        setDoc(loaded);
        pageCountRef.current?.(loaded.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error('[notes] pdf load failed', err);
          setError('This PDF could not be opened. Check your connection and try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [attempt]);

  const zoom = ZOOMS[zoomIndex];
  const pageWidth = Math.max(0, Math.floor((frameWidth - 8) * zoom));

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface-2/95 px-2 py-1.5 backdrop-blur">
        <span className="pl-2 text-sm text-muted-foreground">{doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}` : 'PDF'}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOMS.length - 1}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus className="h-5 w-5" />
          </button>
          {downloadHref && (
            <a href={downloadHref} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-3" aria-label="Download PDF">
              <Download className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>

      <div ref={frameRef} className="w-full overflow-x-auto">
        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setDoc(null);
                setAttempt((n) => n + 1);
              }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : !doc || pageWidth === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Opening PDF…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pb-4" style={{ width: zoom > 1 ? pageWidth + 8 : undefined }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} width={pageWidth} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
