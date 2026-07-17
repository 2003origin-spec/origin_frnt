'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * "Exam begins in HH:MM:SS" banner shown atop the lobby chat when the host has
 * scheduled a start time. Renders nothing once the time has passed (the room
 * auto-starts and everyone is routed into the test by the lobby poll).
 */
export function RoomCountdownBanner({ scheduledStartAt }: { scheduledStartAt: string | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  if (!scheduledStartAt || now === 0) return null;
  const remaining = Math.floor((new Date(scheduledStartAt).getTime() - now) / 1000);
  if (remaining <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
      <CalendarClock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Exam begins in
      </span>
      <span className="font-mono text-sm font-black tabular-nums text-amber-700 dark:text-amber-300">
        {formatCountdown(remaining)}
      </span>
    </div>
  );
}
