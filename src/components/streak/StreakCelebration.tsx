'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import type { StreakTouchResult } from '@/server/streak-login';

/**
 * First-login-of-the-day streak celebration (Phase 4). A full-screen flame
 * takeover that fires once, lives ~1.2s, then auto-dismisses. The server has
 * already decided this should show (see `touchLoginStreak`) — this component
 * only renders and self-dismisses; it never re-triggers.
 *
 *  - `increased` / `first` → the number pops with a "+1" and a party blast.
 *  - `reset`              → the old number bursts, a fresh 1 is reborn.
 *  - `same`               → a gentle "welcome back" (streak already advanced today).
 */

interface StreakCelebrationProps {
  celebration: StreakTouchResult;
  onDismiss: () => void;
}

/** ~1.2s on screen (spec: ≈1s), then the exit fade. */
const LIFE_MS = 1200;

const SPARK_COLORS = ['#ffe66b', '#ff9d2f', '#ff5023', '#ffd15c', '#ff7a1a', '#fff2c4'];

/** Confetti spread symmetrically left+right so embers rise on both sides. */
function makeSparks(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1; // alternate sides → balanced
    const spreadX = (0.1 + Math.random() * 0.9) * 260 * side;
    return {
      id: i,
      x: spreadX,
      y: -(120 + Math.random() * 320),
      color: SPARK_COLORS[i % SPARK_COLORS.length],
      delay: Math.random() * 0.1,
      size: 6 + Math.random() * 6,
    };
  });
}

export default function StreakCelebration({ celebration, onDismiss }: StreakCelebrationProps) {
  const reduce = useReducedMotion();
  const { event, previous, current } = celebration;
  const isReset = event === 'reset';

  // For a reset, briefly show the old number, then swap to the reborn 1.
  const [shown, setShown] = useState(isReset ? previous : current);
  const [sparks] = useState(() => (reduce ? [] : makeSparks(event === 'same' ? 24 : 60)));

  const dismissedRef = useRef(false);
  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  };

  // Reset: swap the number mid-animation (old bursts → new reborn).
  useEffect(() => {
    if (!isReset) return;
    const t = setTimeout(() => setShown(current), 260);
    return () => clearTimeout(t);
  }, [isReset, current]);

  // Auto-dismiss after the celebration has played.
  useEffect(() => {
    const t = setTimeout(dismiss, LIFE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headline = isReset
    ? 'Streak reset'
    : event === 'same'
      ? 'Welcome back'
      : `${current}-day streak!`;
  const subline = isReset
    ? 'A new fire starts today'
    : event === 'same'
      ? `${current}-day streak — keep it going`
      : 'Keep it lit 🔥';

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.3 }}
      onClick={dismiss}
      role="status"
      aria-live="polite"
      aria-label={`${current} day login streak`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0a0710]/90 backdrop-blur-md" />

      {/* Flame + number cluster */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex items-center justify-center" style={{ width: 'min(78vw, 320px)', height: 'min(78vw, 320px)' }}>
          {/* Warm glow */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '78%',
              height: '78%',
              background: 'radial-gradient(circle, rgba(255,140,40,0.5), rgba(255,80,20,0) 66%)',
              filter: 'blur(8px)',
            }}
            animate={reduce ? {} : { scale: [1, 1.07, 1], opacity: [0.72, 1, 0.72] }}
            transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
          />

          {/* Static bonfire image with a flare-in on mount */}
          <motion.div
            className="absolute bottom-[2%] left-1/2 -translate-x-1/2"
            style={{ width: '118%' }}
            initial={{ scale: reduce ? 1 : 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            <Image
              src="/streak/flame.png"
              alt=""
              width={380}
              height={380}
              className="h-auto w-full"
              style={{ filter: 'drop-shadow(0 0 18px rgba(255,110,30,0.5))' }}
              priority
            />
          </motion.div>

          {/* Sparks (both sides) */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
            <AnimatePresence>
              {sparks.map((s) => (
                <motion.span
                  key={s.id}
                  className="absolute rounded-full"
                  style={{ left: '50%', top: '62%', width: s.size, height: s.size, backgroundColor: s.color }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: s.delay }}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Streak number */}
          <AnimatePresence mode="wait">
            <motion.div
              key={shown}
              className="relative z-10 font-mono font-extrabold text-white"
              style={{
                fontSize: 'clamp(5rem, 24vw, 9.5rem)',
                lineHeight: 0.9,
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 16px rgba(255,170,60,0.7), 0 0 44px rgba(255,90,20,0.6), 0 5px 0 rgba(120,30,0,0.3)',
              }}
              initial={
                isReset && shown === current
                  ? { scale: 0, opacity: 0, filter: 'blur(6px)' } // reborn
                  : { scale: reduce ? 1 : 0.4, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={
                isReset
                  ? { scale: 0.15, y: 26, opacity: 0, filter: 'blur(8px)' } // shatter
                  : { opacity: 0 }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            >
              {shown}
            </motion.div>
          </AnimatePresence>

          {/* Floating +1 (increase only) */}
          {!reduce && (event === 'increased' || event === 'first') && (
            <motion.div
              className="pointer-events-none absolute left-1/2 top-[26%] z-20 -translate-x-1/2 font-mono text-3xl font-extrabold text-[#ffe66b]"
              style={{ textShadow: '0 0 16px rgba(255,140,40,0.85)' }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -64, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              +1
            </motion.div>
          )}
        </div>

        {/* Copy */}
        <motion.h2
          className="mt-2 text-center text-2xl font-black tracking-tight text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {headline}
        </motion.h2>
        <motion.p
          className={`mt-1 text-center text-sm font-semibold ${isReset ? 'text-[#ff8a5c]' : 'text-[#ffd15c]'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {subline}
        </motion.p>
      </div>
    </motion.div>
  );
}
