'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const Ori2D = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

type Remaining = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

function computeRemaining(launchAt: string | null): Remaining {
  const zero = { days: 0, hours: 0, minutes: 0, seconds: 0, done: false };
  if (!launchAt) return zero;
  const target = new Date(launchAt).getTime();
  if (Number.isNaN(target)) return zero;
  const diff = target - Date.now();
  if (diff <= 0) return { ...zero, done: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: false,
  };
}

function Unit({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="neu-raised rounded-2xl px-4 py-3 sm:px-6 sm:py-4 min-w-[68px] sm:min-w-[92px]">
        <span className="font-heading font-black tabular-nums text-3xl sm:text-5xl text-foreground">
          {value === null ? '--' : String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="mt-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Pre-launch cover — hides the whole site behind a live countdown. When the
 * timer reaches zero it shows a launch popup, then reveals the site by asking
 * the server to re-render (the server cover gate is already false past launch).
 */
export default function LaunchCover({ launchAt }: { launchAt: string | null }) {
  const router = useRouter();
  // Computed client-side only: the exact remaining time depends on Date.now(),
  // which differs between the SSR pass and hydration and would trip a hydration
  // mismatch. Start null (placeholder digits) and fill in on mount.
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const tick = () => {
      const next = computeRemaining(launchAt);
      setRemaining(next);
      if (next.done) setLaunched(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [launchAt]);

  // A few Ori mascots wandering around while everyone waits for the launch.
  const wanderers = [
    { top: '12%', left: '8%', delay: 0, dur: 11, x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: 0.7 },
    { top: '20%', right: '10%', delay: 1.2, dur: 13, x: [0, -50, 30, 0], y: [0, 25, -25, 0], scale: 0.6 },
    { bottom: '16%', left: '14%', delay: 0.6, dur: 12, x: [0, 60, -30, 0], y: [0, -20, 30, 0], scale: 0.55 },
    { bottom: '22%', right: '12%', delay: 1.8, dur: 14, x: [0, -40, 20, 0], y: [0, 30, -20, 0], scale: 0.65 },
  ];

  return (
    <main className="relative min-h-dvh w-full overflow-hidden neu-surface flex items-center justify-center px-5 py-10">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 75% 20%, hsl(var(--primary)/0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 20% 80%, hsl(var(--primary)/0.08) 0%, transparent 70%)',
        }}
      />

      {/* Wandering Oris */}
      {wanderers.map((w, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute hidden sm:block"
          style={{ top: w.top, bottom: w.bottom, left: w.left, right: w.right }}
          animate={{ x: w.x, y: w.y }}
          transition={{ duration: w.dur, delay: w.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ transform: `scale(${w.scale})` }}>
            <Ori2D expression="excited" float className="w-24 h-24" />
          </div>
        </motion.div>
      ))}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        <motion.img
          src="/ori2d/ori-exited.png"
          alt="Ori"
          className="w-36 h-36 sm:w-52 sm:h-52 object-contain drop-shadow-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: [0, -10, 0] }}
          transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.6 } }}
        />

        <div className="mt-3 inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-heading font-black text-primary tracking-[0.35em] uppercase">Launching In</span>
        </div>

        {launchAt ? (
          <div className="mt-6 flex items-end justify-center gap-2 sm:gap-4">
            <Unit value={remaining?.days ?? null} label="Days" />
            <Unit value={remaining?.hours ?? null} label="Hours" />
            <Unit value={remaining?.minutes ?? null} label="Minutes" />
            <Unit value={remaining?.seconds ?? null} label="Seconds" />
          </div>
        ) : (
          <h1 className="mt-6 text-4xl sm:text-6xl font-heading font-black tracking-tighter text-foreground">Launching Soon</h1>
        )}

        <p className="mt-8 text-lg sm:text-2xl font-heading font-black tracking-tight text-foreground max-w-xl text-balance">
          Be ready to experience{' '}
          <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">India&apos;s First EdTech EcoSystem</span>.
        </p>
      </div>

      {/* Launch popup on countdown completion */}
      <AnimatePresence>
        {launched && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="neu-raised w-full max-w-md rounded-3xl p-8 text-center"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ori2d/ori-exited.png" alt="Ori" className="mx-auto w-28 h-28 object-contain drop-shadow-lg" />
              <h2 className="mt-4 text-3xl font-heading font-black tracking-tight text-foreground">We are live!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The wait is over. Welcome to India&apos;s first EdTech EcoSystem.
              </p>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-sm font-heading font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Enter O3Origin
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
