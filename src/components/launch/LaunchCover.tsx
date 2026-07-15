'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const Ori2D = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
const Confetti = dynamic(() => import('@/components/launch/Confetti'), { ssr: false });

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
  const display = value === null ? '--' : String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative neu-raised rounded-2xl px-4 py-3.5 sm:px-7 sm:py-5 min-w-[70px] sm:min-w-[104px] overflow-hidden">
        <span
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)/0.6), transparent)' }}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={display}
            initial={{ y: '-60%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '60%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="block font-heading font-black tabular-nums text-4xl sm:text-6xl text-foreground leading-none"
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</span>
    </div>
  );
}

// Ori mascots drifting around the page while everyone waits — varied faces,
// sizes and paths so it feels lively, not repetitive.
const WANDERERS = [
  { expr: 'excited' as const,    top: '10%',    left: '7%',   dur: 12, delay: 0,   x: [0, 44, -22, 0], y: [0, -34, 22, 0], size: 132 },
  { expr: 'thumbsup' as const,   top: '16%',    right: '8%',  dur: 14, delay: 1.1, x: [0, -52, 30, 0], y: [0, 26, -26, 0], size: 108 },
  { expr: 'cheerful' as const,   bottom: '14%', left: '11%',  dur: 13, delay: 0.6, x: [0, 60, -30, 0], y: [0, -22, 30, 0], size: 96 },
  { expr: 'proud' as const,      bottom: '18%', right: '10%', dur: 15, delay: 1.7, x: [0, -42, 22, 0], y: [0, 32, -22, 0], size: 120 },
  { expr: 'winking' as const,    top: '46%',    left: '3%',   dur: 16, delay: 2.3, x: [0, 34, -18, 0], y: [0, 26, -30, 0], size: 76 },
  { expr: 'curious' as const,    top: '52%',    right: '4%',  dur: 17, delay: 0.9, x: [0, -30, 20, 0], y: [0, -28, 24, 0], size: 80 },
];

/**
 * Pre-launch cover — hides the whole site behind a live countdown. When the
 * timer reaches zero, confetti blasts and a launch popup appears; entering
 * re-renders the server (the cover gate is already false past launch).
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

  return (
    <main className="relative min-h-dvh w-full overflow-hidden neu-surface flex items-center justify-center px-5 py-12">
      {/* Ambient depth: soft brand glows + faint grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 78% 18%, hsl(var(--primary)/0.12) 0%, transparent 70%), radial-gradient(ellipse 55% 40% at 18% 82%, hsl(var(--primary)/0.10) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 45%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 45%, #000 30%, transparent 80%)',
        }}
      />

      {/* Wandering Oris (decorative, desktop only) */}
      {WANDERERS.map((w, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute hidden md:block"
          style={{ top: w.top, bottom: w.bottom, left: w.left, right: w.right }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.95, x: w.x, y: w.y }}
          transition={{
            opacity: { duration: 1, delay: w.delay * 0.3 },
            x: { duration: w.dur, delay: w.delay, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: w.dur, delay: w.delay, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div style={{ width: w.size, height: w.size }}>
            <Ori2D expression={w.expr} float title="Ori" />
          </div>
        </motion.div>
      ))}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.9, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* glow halo behind hero */}
          <div
            className="absolute inset-0 -z-10 blur-2xl"
            style={{ background: 'radial-gradient(circle at 50% 45%, hsl(var(--primary)/0.35), transparent 65%)' }}
          />
          <motion.img
            src="/ori2d/ori-exited.png"
            alt="Ori"
            className="w-36 h-36 sm:w-52 sm:h-52 object-contain drop-shadow-2xl"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.div
          className="mt-4 inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-[10px] font-heading font-black text-primary tracking-[0.35em] uppercase">Launching In</span>
        </motion.div>

        {launchAt ? (
          <motion.div
            className="mt-7 flex items-start justify-center gap-2.5 sm:gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Unit value={remaining?.days ?? null} label="Days" />
            <span className="font-heading font-black text-3xl sm:text-5xl text-muted-foreground/40 pt-2 sm:pt-3">:</span>
            <Unit value={remaining?.hours ?? null} label="Hours" />
            <span className="font-heading font-black text-3xl sm:text-5xl text-muted-foreground/40 pt-2 sm:pt-3">:</span>
            <Unit value={remaining?.minutes ?? null} label="Minutes" />
            <span className="font-heading font-black text-3xl sm:text-5xl text-muted-foreground/40 pt-2 sm:pt-3">:</span>
            <Unit value={remaining?.seconds ?? null} label="Seconds" />
          </motion.div>
        ) : (
          <h1 className="mt-7 text-4xl sm:text-6xl font-heading font-black tracking-tighter text-foreground">Launching Soon</h1>
        )}

        <motion.p
          className="mt-9 text-lg sm:text-2xl font-heading font-black tracking-tight text-foreground max-w-xl text-balance"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Be ready to experience{' '}
          <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">India&apos;s First AI EdTech EcoSystem</span>.
        </motion.p>
      </div>

      {/* Launch celebration: confetti blast + premium popup */}
      {launched && <Confetti durationMs={7000} />}
      <AnimatePresence>
        {launched && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative neu-raised w-full max-w-md rounded-[28px] p-8 text-center overflow-hidden"
              initial={{ scale: 0.8, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }}
              />
              <motion.img
                src="/ori2d/ori-proud.png"
                alt="Ori"
                className="mx-auto w-32 h-32 object-contain drop-shadow-2xl"
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0, y: [0, -8, 0] }}
                transition={{ scale: { type: 'spring', stiffness: 200, damping: 12 }, y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
              />
              <h2 className="mt-4 text-3xl font-heading font-black tracking-tight text-foreground">We&apos;re live!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The wait is over. Welcome to India&apos;s First AI EdTech EcoSystem.
              </p>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-sm font-heading font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
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
