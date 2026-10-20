'use client';

/**
 * Admin Notes → Checks: the Phase 0 checks (V1/NOTES_PLAN.md §12).
 *
 * - Storage, from the server: every R2 call Notes makes, against the real
 *   private bucket.
 * - Storage, from this browser: the bucket's CORS rules (upload + read).
 * - This device: run it on a phone, inside the Android app — PDF rendering,
 *   microphone recording, camera/file picker. "Copy results" gives a summary
 *   to paste into the plan.
 */

import { useRef, useState } from 'react';
import { CheckCircle2, Copy, Mic, Square, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/notes/rules';
import { PdfViewer } from '@/components/notes/PdfViewer';

import { adminNotes, errorMessage } from './admin-notes-api';
import { Btn, Panel } from './admin-ui';

type Step = { name: string; ok: boolean; ms: number; detail: string };

/** Sample PDFs already in the app (NCERT library): a small one and a ~19 MB one. */
const SMALL_PDF = '/books/11/Physics/Part1/Chapter%201.pdf';
const BIG_PDF = '/books/12/Biology/Chapter%204.pdf';

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {steps.map((step, index) => (
        <li key={`${step.name}-${index}`} className="flex items-start gap-2 text-sm">
          {step.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Failed" />}
          <span>
            <span className="font-semibold">{step.name}</span>
            <span className="text-muted-foreground"> · {step.ms} ms · {step.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function environment() {
  const ua = navigator.userAgent;
  const chrome = /Chrome\/(\d+)/u.exec(ua)?.[1] ?? null;
  const recorderTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].filter((type) => {
    try {
      return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
  return {
    inAndroidApp: /OriginApp\/\d+/u.test(ua),
    appVersion: /OriginApp\/(\d+)/u.exec(ua)?.[1] ?? null,
    chromeOrWebView: chrome,
    screen: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    promiseWithResolvers: typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    recorderTypes,
    getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    userAgent: ua,
  };
}

export function ChecksPanel() {
  const [serverSteps, setServerSteps] = useState<Step[] | null>(null);
  const [browserSteps, setBrowserSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [env, setEnv] = useState<ReturnType<typeof environment> | null>(null);
  const [pdf, setPdf] = useState<{ url: string; started: number; pages?: number; ms?: number } | null>(null);
  const [recording, setRecording] = useState<{ state: 'idle' | 'recording' | 'done' | 'error'; detail: string; url?: string }>({ state: 'idle', detail: '' });
  const [picked, setPicked] = useState<{ name: string; type: string; size: number; preview?: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const runServer = async () => {
    setBusy('server');
    try {
      const result = await adminNotes<{ ok: boolean; steps: Step[] }>('checks/storage', { method: 'POST' });
      setServerSteps(result.steps);
    } catch (err) {
      setServerSteps([{ name: 'Storage check', ok: false, ms: 0, detail: errorMessage(err) }]);
    } finally {
      setBusy(null);
    }
  };

  const runBrowser = async () => {
    setBusy('browser');
    const steps: Step[] = [];
    const timed = async (name: string, fn: () => Promise<string>) => {
      const started = performance.now();
      try {
        steps.push({ name, ok: true, ms: Math.round(performance.now() - started), detail: await fn() });
        return true;
      } catch (err) {
        steps.push({ name, ok: false, ms: Math.round(performance.now() - started), detail: errorMessage(err) });
        return false;
      }
    };
    const holder: { links: { checkKey: string; putUrl: string; getUrl: string } | null } = { links: null };
    await timed('Get test links', async () => {
      holder.links = await adminNotes('checks/browser', { method: 'POST' });
      return 'signed links issued';
    });
    const links = holder.links;
    if (links) {
      const uploaded = await timed('Upload from this browser (CORS PUT)', async () => {
        const response = await fetch(links.putUrl, { method: 'PUT', body: new Blob(['origin-notes-browser-check'], { type: 'text/plain' }), headers: { 'Content-Type': 'text/plain' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return `HTTP ${response.status}`;
      });
      if (uploaded) {
        await timed('Read back from this browser (CORS GET)', async () => {
          const response = await fetch(links.getUrl, { headers: { Range: 'bytes=0-11' } });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          return `HTTP ${response.status}, got "${text.slice(0, 12)}", Content-Range ${response.headers.get('content-range') ?? 'not exposed'}`;
        });
      }
      await timed('Server confirms and deletes', async () => {
        const result = await adminNotes<{ arrived: boolean; bytes: number }>('checks/browser/finish', { method: 'POST', body: { checkKey: links.checkKey } });
        if (!result.arrived) throw new Error('the upload never reached the bucket');
        return `${result.bytes} bytes arrived; test file deleted`;
      });
    }
    setBrowserSteps(steps);
    setBusy(null);
  };

  const record = async () => {
    if (recording.state === 'recording') {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = environment().recorderTypes[0];
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setRecording({ state: 'done', detail: `${recorder.mimeType || 'unknown type'} · ${formatBytes(blob.size)}`, url: URL.createObjectURL(blob) });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording({ state: 'recording', detail: 'Recording… speak for a few seconds, then stop.' });
      window.setTimeout(() => recorder.state === 'recording' && recorder.stop(), 8000);
    } catch (err) {
      setRecording({ state: 'error', detail: `${(err as { name?: string }).name ?? 'Error'}: ${errorMessage(err)}` });
    }
  };

  // Pure of browser APIs: it also runs during the server render, where
  // `navigator` doesn't exist. The copy button fills in the device details.
  const summary = (device = env, when?: string) =>
    JSON.stringify(
      {
        when: when ?? null,
        environment: device,
        storageServer: serverSteps,
        storageBrowser: browserSteps,
        pdf: pdf ? { file: pdf.url, pages: pdf.pages ?? null, msToOpen: pdf.ms ?? null } : null,
        microphone: recording.state === 'idle' ? null : { state: recording.state, detail: recording.detail },
        filePicker: picked ? { name: picked.name, type: picked.type, size: picked.size } : null,
      },
      null,
      2,
    );

  return (
    <div className="space-y-4">
      <Panel title="1 · Storage from the server" actions={<Btn tone="primary" onClick={runServer} busy={busy === 'server'}>Run storage check</Btn>}>
        <p className="text-sm text-muted-foreground">Writes a tiny test file to the private notes bucket, checks it every way Notes does, then deletes it.</p>
        {serverSteps && <StepList steps={serverSteps} />}
      </Panel>

      <Panel title="2 · Storage from this browser" actions={<Btn tone="primary" onClick={runBrowser} busy={busy === 'browser'}>Run browser check</Btn>}>
        <p className="text-sm text-muted-foreground">Uploads and reads a test file straight from this browser. If this fails while check 1 passes, the bucket&apos;s CORS rules are missing this site.</p>
        {browserSteps && <StepList steps={browserSteps} />}
      </Panel>

      <Panel title="3 · This device" actions={<Btn onClick={() => setEnv(environment())}>Show device details</Btn>}>
        <p className="text-sm text-muted-foreground">
          Run these on a phone, inside the Origin Android app. The admin menu leaves no room on a phone, so open{' '}
          <a href="/notes/check" className="font-semibold text-primary underline">/notes/check</a> there instead — the same checks, full width.
        </p>
        {env && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Inside Android app</dt>
            <dd>{env.inAndroidApp ? `Yes (version ${env.appVersion})` : 'No'}</dd>
            <dt className="text-muted-foreground">Chrome / WebView</dt>
            <dd>{env.chromeOrWebView ?? 'not Chrome'}</dd>
            <dt className="text-muted-foreground">Screen</dt>
            <dd>{env.screen}</dd>
            <dt className="text-muted-foreground">Voice recording</dt>
            <dd>{env.mediaRecorder && env.getUserMedia ? env.recorderTypes.join(', ') || 'supported, no common type' : 'not supported here'}</dd>
            <dt className="text-muted-foreground">Promise.withResolvers</dt>
            <dd>{env.promiseWithResolvers ? 'yes' : 'no (the PDF viewer uses the legacy build for this)'}</dd>
          </dl>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-bold">PDF viewer</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn onClick={() => setPdf({ url: SMALL_PDF, started: performance.now() })}>Open a 1 MB PDF</Btn>
              <Btn onClick={() => setPdf({ url: BIG_PDF, started: performance.now() })}>Open a 19 MB PDF</Btn>
            </div>
            {pdf && (
              <div className="mt-3 rounded-xl border border-border p-2">
                <p className="mb-2 text-sm text-muted-foreground">
                  {pdf.ms ? `Opened ${pdf.pages} pages in ${pdf.ms} ms. Scroll and zoom to check it stays smooth.` : 'Opening…'}
                </p>
                <div className="max-h-[60vh] overflow-y-auto">
                  <PdfViewer
                    key={pdf.url}
                    resolveUrl={async () => pdf.url}
                    onPageCount={(pages) => setPdf((current) => (current ? { ...current, pages, ms: Math.round(performance.now() - current.started) } : current))}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold">Microphone (voice notes)</h3>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Btn tone={recording.state === 'recording' ? 'danger' : 'secondary'} onClick={record}>
                {recording.state === 'recording' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {recording.state === 'recording' ? 'Stop' : 'Record a few seconds'}
              </Btn>
              {recording.detail && <span className={cn('text-sm', recording.state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{recording.detail}</span>}
            </div>
            {recording.url && <audio controls src={recording.url} className="mt-2 w-full max-w-sm" />}
          </div>

          <div>
            <h3 className="text-sm font-bold">Camera and file picker</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-border bg-surface-1 px-4 text-sm font-semibold hover:bg-surface-2">
                Take a photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPicked({ name: file.name, type: file.type, size: file.size, preview: URL.createObjectURL(file) });
                  }}
                />
              </label>
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-border bg-surface-1 px-4 text-sm font-semibold hover:bg-surface-2">
                Pick a file
                <input
                  type="file"
                  accept="application/pdf,image/*,audio/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPicked({ name: file.name, type: file.type, size: file.size, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined });
                  }}
                />
              </label>
            </div>
            {picked && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {picked.preview && <img src={picked.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />}
                <span>
                  {picked.name} · {picked.type || 'unknown type'} · {formatBytes(picked.size)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Btn
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(summary(env ?? environment(), new Date().toISOString()));
            toast.success('Results copied');
          } catch {
            toast.error('Could not copy. Select the text below instead.');
          }
        }}
      >
        <Copy className="h-4 w-4" /> Copy results
      </Btn>
      <pre className="max-h-64 overflow-auto rounded-xl bg-surface-1 p-3 text-xs">{summary()}</pre>
    </div>
  );
}
