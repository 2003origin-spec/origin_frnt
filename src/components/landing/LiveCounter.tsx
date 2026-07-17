'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface LiveStats {
  visits: number;
  questionsSolved: number;
  streaksActive: number;
}

// One visit per full page load: module-level so remounts (client-side route
// back-and-forth to the landing page, StrictMode double-mount in dev) don't
// re-send ?first=1 and inflate the all-time counter.
let visitCounted = false;

function OdometerDigit({ value }: { value: string }) {
  const prefersReduced = useReducedMotion();
  if (!value.match(/\d/)) return <span className="align-middle">{value}</span>;

  return (
    <span className="inline-flex items-center justify-center overflow-hidden relative w-[0.6em] h-[1.2em] align-middle">
      <motion.span
        key={value}
        initial={prefersReduced ? false : { y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex items-center justify-center font-mono tabular-nums leading-none"
      >
        {value}
      </motion.span>
    </span>
  );
}

function OdometerNumber({ value }: { value: number }) {
  const formatted = Math.max(0, value).toLocaleString('en-IN');
  return (
    <span className="font-mono tabular-nums inline-flex items-center align-middle">
      {formatted.split('').map((ch, i) => (
        <OdometerDigit key={i} value={ch} />
      ))}
    </span>
  );
}

export default function LiveCounter() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  async function fetchStats(first = false) {
    try {
      // Only the first call per page load tags ?first=1, which increments the
      // all-time visit counter server-side (polls must not inflate it).
      const res = await fetch(`/api/public/live-stats${first ? '?first=1' : ''}`, { cache: 'no-store' });
      if (res.ok) setStats(await res.json());
    } catch {
      // silently degrade
    }
  }

  useEffect(() => {
    const isFirst = !visitCounted;
    visitCounted = true;
    fetchStats(isFirst);
    // Re-pull the real numbers periodically (no client-side fabrication).
    intervalRef.current = setInterval(() => fetchStats(false), 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.9 }}
      className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 neu-inset px-6 py-3.5 rounded-full border border-white/10 dark:border-black/5"
    >
      {/* Total site visits — "aspirants & counting" */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 leading-none">
        <span className="relative flex h-2 w-2 shrink-0 self-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.visits} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">aspirants &amp; counting</span>
        </div>
      </div>

      <div className="w-px h-4 bg-muted-foreground/30 hidden sm:block self-center" />

      {/* All-time questions solved — "questions conquered" */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 leading-none">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.questionsSolved} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">questions conquered</span>
        </div>
      </div>

      <div className="w-px h-4 bg-muted-foreground/30 hidden sm:block self-center" />

      {/* Active streaks */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 leading-none">
        <span className="text-sm self-center">🔥</span>
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-heading font-black text-foreground">
            <OdometerNumber value={stats.streaksActive} />
          </span>
          <span className="text-muted-foreground font-medium text-xs">active streaks</span>
        </div>
      </div>
    </motion.div>
  );
}
