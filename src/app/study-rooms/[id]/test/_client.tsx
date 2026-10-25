'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import TestInterface from '@/sections/TestInterface';
import { submitRoomTestAction } from '@/server/actions/study-room-actions';
import { apiCall } from '@/lib/api';
import { isStudyRoomUnavailableError } from '@/lib/study-rooms/errors';
import type { Test, TestResult } from '@/types';
import type { StudyRoomSummary } from '@/context/StudyRoomContext';
import {
  betterSkew,
  provisionalSkewFromRender,
  serverNowFrom,
  skewFromRoundTrip,
  type MeasuredSkew,
} from '@/lib/server-clock';

/** Longest the paper waits for a live clock measurement before using the provisional offset. */
const CLOCK_SYNC_TIMEOUT_MS = 6000;

function Countdown({ startedAt, skewMs }: { startedAt: string; skewMs: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(serverNowFrom(skewMs, Date.now())), 100);
    return () => window.clearInterval(interval);
  }, [skewMs]);
  if (now === 0) return null;
  const remaining = Math.max(0, Math.ceil((new Date(startedAt).getTime() - now) / 1000));
  if (remaining <= 0) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center neu-surface text-foreground">
      <div className="text-center">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-primary">Starting In</p>
        <div className="text-8xl font-black tabular-nums text-foreground">{remaining}</div>
      </div>
    </div>
  );
}

export default function RoomTestClient({
  roomId,
  room,
  initialTest,
  serverNow,
}: {
  roomId: string;
  room: StudyRoomSummary;
  initialTest: Test;
  /** Server clock (ms) when this page was rendered (may be a cached render). */
  serverNow: number;
}) {
  const router = useRouter();
  // A device clock that is minutes off must not end the paper early (fast
  // clock) or hide a running test behind "Starting in" (slow clock). The
  // offset is measured from the uncached room poll (it carries the server's
  // clock): the rendered `serverNow` may come from the service-worker cache or
  // the back/forward cache, and its age would count as skew, so it is only
  // trusted for a small offset until the first live measurement lands.
  const [provisionalSkewMs] = useState(() =>
    provisionalSkewFromRender({ clientNowMs: Date.now(), serverNowMs: serverNow }),
  );
  const [measured, setMeasured] = useState<MeasuredSkew | null>(null);
  const measuredRef = useRef<MeasuredSkew | null>(null);
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const skewMs = measured?.skewMs ?? provisionalSkewMs;
  const clockReady = measured !== null || syncTimedOut;
  useEffect(() => {
    const timeout = window.setTimeout(() => setSyncTimedOut(true), CLOCK_SYNC_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, []);
  // Memoised: a fresh object every render re-armed the timer effect.
  const timerSource = useMemo(
    () => ({
      startedAt: room.started_at ?? new Date(serverNow).toISOString(),
      durationSeconds: room.duration_seconds ?? initialTest.duration * 60,
      skewMs,
    }),
    [room.started_at, room.duration_seconds, initialTest.duration, serverNow, skewMs],
  );

  // Teacher Live Rooms: stamp `entered_test_at` and keep `last_seen_at` fresh so
  // the teacher's live student list shows this student as "giving the test".
  useEffect(() => {
    let cancelled = false;
    const ping = (): void => {
      void apiCall(`/study-rooms/${roomId}`, { method: 'POST', body: JSON.stringify({ on_test: true }) }).catch(() => undefined);
    };
    ping();
    const interval = window.setInterval(() => {
      if (!cancelled) ping();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [roomId]);

  useEffect(() => {
    let isDisposed = false;
    let didRedirect = false;

    const redirectUnavailable = (): void => {
      if (!didRedirect) {
        didRedirect = true;
        toast.info('Room is no longer available.');
      }
      router.push('/study-rooms');
    };

    const verifyRoomAvailable = async (): Promise<void> => {
      try {
        const sentAtMs = Date.now();
        const payload = await apiCall(`/study-rooms/${roomId}`); // cache: 'no-store'
        if (isDisposed) return;
        const next = betterSkew(
          measuredRef.current,
          skewFromRoundTrip({ sentAtMs, receivedAtMs: Date.now(), serverNowMs: payload?.server_now_ms }),
        );
        if (next !== measuredRef.current) {
          measuredRef.current = next;
          setMeasured(next);
        }
        if (payload.room?.status === 'closed') {
          redirectUnavailable();
        }
      } catch (error) {
        if (isStudyRoomUnavailableError(error)) {
          redirectUnavailable();
        }
      }
    };

    // First poll right away: it also measures the clock offset.
    void verifyRoomAvailable();
    const interval = window.setInterval(() => {
      void verifyRoomAvailable();
    }, 5000);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [roomId, router]);

  const handleComplete = (result: TestResult): void => {
    sessionStorage.setItem(`origin_room_test_result_${roomId}`, JSON.stringify(result));
    sessionStorage.setItem(`origin_test_result_${initialTest.id}`, JSON.stringify(result));
    if (result.id) {
      sessionStorage.setItem(`origin_test_result_id_${result.id}`, JSON.stringify(result));
    }
    window.location.assign(`/study-rooms/${roomId}/leaderboard`);
  };

  if (!clockReady) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center neu-surface text-foreground">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">Syncing with the room…</p>
      </div>
    );
  }

  return (
    <>
      <Countdown startedAt={timerSource.startedAt} skewMs={skewMs} />
      <TestInterface
        test={initialTest}
        timerSource={timerSource}
        submitHandler={(payload) => submitRoomTestAction(roomId, payload)}
        onComplete={handleComplete}
        onExit={() => router.push(`/study-rooms/${roomId}/lobby`)}
      />
    </>
  );
}
