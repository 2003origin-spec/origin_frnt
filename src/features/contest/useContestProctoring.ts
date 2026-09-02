'use client';

import { useEffect, useRef, useState } from 'react';

import { mutateJson } from '@/lib/csrf';

/**
 * Self-hosted webcam-snapshot proctoring (Phase 3B). When `enabled`, asks for
 * camera consent and, once granted, captures a low-res JPEG every ~45s, uploads
 * it to R2 via a presigned PUT, and registers the key. Fails silently (never
 * blocks the exam); returns the consent state so the UI can show a notice.
 */
export function useContestProctoring(contestId: string, enabled: boolean) {
  const [consent, setConsent] = useState<'idle' | 'granted' | 'denied'>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play().catch(() => undefined);
        videoRef.current = video;
        setConsent('granted');

        const capture = async () => {
          try {
            const v = videoRef.current;
            if (!v || v.videoWidth === 0) return;
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 240;
            canvas.getContext('2d')?.drawImage(v, 0, 0, 320, 240);
            const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.6));
            if (!blob) return;
            const pres = await mutateJson('/api/contest/proctor', { method: 'POST', body: JSON.stringify({ contestId, action: 'presign' }) });
            const p = (await pres.json().catch(() => ({}))) as { uploadUrl?: string; r2Key?: string };
            if (!p.uploadUrl || !p.r2Key) return;
            const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
            if (!put.ok) return;
            await mutateJson('/api/contest/proctor', { method: 'POST', body: JSON.stringify({ contestId, action: 'register', r2Key: p.r2Key }) });
          } catch { /* non-blocking */ }
        };
        void capture();
        timer = window.setInterval(() => void capture(), 45_000);
      } catch {
        if (!cancelled) setConsent('denied');
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [contestId, enabled]);

  return { consent };
}
