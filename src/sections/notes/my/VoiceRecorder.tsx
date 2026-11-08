'use client';

/**
 * Record a voice note in the browser (V1/NOTES_PLAN.md §3, Phase 3):
 * record → pause/resume → stop → listen → save. Up to 15 minutes. Android
 * Chrome records WebM/Opus, iPhone Safari MP4/AAC; both are accepted types.
 * The recorded length is measured here, because WebM recordings often report
 * no duration to the player.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Mic, Pause, Square, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { VOICE_MAX_SECONDS } from '@/lib/notes/storage-rules';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { formatDuration } from './my-ui';

type Phase = 'idle' | 'starting' | 'recording' | 'paused' | 'done';

const CANDIDATES: { mime: string; ext: string }[] = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];

function pickFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

/** "19.10.2026 01.33" — dd.mm.yyyy and the time in IST (the app-wide rule), safe in a file name. */
function istStamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}.${parts.minute}`;
}

function micError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission was refused. Allow it in your browser or phone settings, then try again.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  return 'The microphone could not be started. Close other apps using it and try again.';
}

export function VoiceRecorder({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File, durationS: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const elapsed = useRef(0);
  const tick = useRef<number | null>(null);
  /** Bumped on close/unmount: a microphone that opens after that is shut at once. */
  const attempt = useRef(0);

  const stopTimer = () => {
    if (tick.current !== null) window.clearInterval(tick.current);
    tick.current = null;
  };

  const releaseMic = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  const finish = () => {
    stopTimer();
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };

  const startTimer = () => {
    stopTimer();
    tick.current = window.setInterval(() => {
      elapsed.current += 1;
      setSeconds(elapsed.current);
      if (elapsed.current >= VOICE_MAX_SECONDS) finish();
    }, 1000);
  };

  // Leaving the dialog any way at all lets go of the microphone.
  useEffect(() => {
    if (open) return;
    attempt.current += 1;
    stopTimer();
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    releaseMic();
  }, [open]);

  useEffect(() => () => {
    attempt.current += 1;
    stopTimer();
    releaseMic();
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const start = async () => {
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t record audio. Record in another app and upload the file instead.');
      return;
    }
    setError(null);
    setPhase('starting');
    const mine = ++attempt.current;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      if (mine !== attempt.current) return;
      setPhase('idle');
      setError(micError(err));
      return;
    }
    // The dialog was closed (or the page left) while permission was pending:
    // never start recording behind the student's back.
    if (mine !== attempt.current) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }
    stream.current = media;
    chunks.current = [];
    elapsed.current = 0;
    setSeconds(0);
    const rec = new MediaRecorder(stream.current, { mimeType: format.mime, audioBitsPerSecond: 48_000 });
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    rec.onstop = () => {
      releaseMic();
      const type = format.mime.split(';')[0];
      const blob = new Blob(chunks.current, { type });
      const file = new File([blob], `Voice note ${istStamp(new Date())}.${format.ext}`, { type });
      setPreview({ url: URL.createObjectURL(blob), file });
      setPhase('done');
    };
    recorder.current = rec;
    rec.start(1000);
    setPhase('recording');
    startTimer();
  };

  const pause = () => {
    recorder.current?.pause();
    stopTimer();
    setPhase('paused');
  };

  const resume = () => {
    recorder.current?.resume();
    setPhase('recording');
    startTimer();
  };

  const discard = () => {
    setPreview(null);
    setSeconds(0);
    elapsed.current = 0;
    setPhase('idle');
  };

  const save = () => {
    if (!preview) return;
    onSave(preview.file, Math.max(1, elapsed.current));
    discard();
    onOpenChange(false);
  };

  const left = VOICE_MAX_SECONDS - seconds;
  const round = 'flex h-16 w-16 items-center justify-center rounded-full';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record a voice note</DialogTitle>
          <DialogDescription>Up to 15 minutes. You can pause and carry on.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <p className={cn('font-display text-4xl font-bold tabular-nums', phase === 'recording' && 'text-destructive')} aria-live="polite">
            {formatDuration(seconds) ?? '0:00'}
          </p>
          {(phase === 'recording' || phase === 'paused') && left <= 60 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">{left} seconds left</p>
          )}

          {phase === 'idle' || phase === 'starting' ? (
            <button type="button" onClick={start} disabled={phase === 'starting'} className={cn(round, 'bg-destructive text-destructive-foreground')} aria-label="Start recording">
              {phase === 'starting' ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
            </button>
          ) : phase === 'recording' || phase === 'paused' ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={phase === 'recording' ? pause : resume}
                className={cn(round, 'border border-border bg-surface-1')}
                aria-label={phase === 'recording' ? 'Pause recording' : 'Carry on recording'}
              >
                {phase === 'recording' ? <Pause className="h-7 w-7" /> : <Mic className="h-7 w-7 text-destructive" />}
              </button>
              <button type="button" onClick={finish} className={cn(round, 'bg-primary text-primary-foreground')} aria-label="Stop recording">
                <Square className="h-6 w-6" />
              </button>
            </div>
          ) : preview ? (
            <div className="w-full space-y-3">
              <audio controls src={preview.url} className="w-full" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={discard} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold hover:bg-surface-2">
                  <Trash2 className="h-4 w-4" aria-hidden /> Record again
                </button>
                <button type="button" onClick={save} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  <Check className="h-4 w-4" aria-hidden /> Save
                </button>
              </div>
            </div>
          ) : null}

          {phase === 'idle' && !error && <p className="text-center text-sm text-muted-foreground">Tap the red button to start.</p>}
          {error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
