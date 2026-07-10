'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X } from 'lucide-react';
import { getBadgeForTier } from '@/lib/badges';
import { apiCall } from '@/lib/api';

interface BadgeUnlockPopupProps {
  badgeNames: string[];
  onDismiss: () => void;
  onAfterSeen?: () => void;
}

function Particle({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{ left: '50%', top: '40%', backgroundColor: color }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    />
  );
}

const PARTICLE_COLORS = ['#facc15', '#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c'];

function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 500,
    y: (Math.random() - 0.5) * 500 - 100,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));
}

export default function BadgeUnlockPopup({ badgeNames, onDismiss, onAfterSeen }: BadgeUnlockPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [particles] = useState(() => generateParticles(40));
  const [showParticles, setShowParticles] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const currentBadge = getBadgeForTier(badgeNames[currentIndex]);

  useEffect(() => {
    setShowParticles(false);
    const t = setTimeout(() => setShowParticles(true), 100);
    return () => clearTimeout(t);
  }, [currentIndex]);

  // Guard so a fast double-tap / overlapping handlers can't fire dismiss twice.
  const dismissedRef = useRef(false);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss(); // close immediately — don't wait for the API
    apiCall('/users/badges/seen/', { method: 'POST' })
      .catch(() => {})
      .finally(() => onAfterSeen?.());
  };

  const advance = () => {
    if (currentIndex < badgeNames.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      handleDismiss();
    }
  };

  useEffect(() => {
    timerRef.current = setTimeout(advance, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Invalid/unknown badge name — dismiss via an effect (never call setState during render).
  useEffect(() => {
    if (!currentBadge) handleDismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBadge]);

  if (!currentBadge) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={advance}
      role="button"
      tabIndex={0}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Explicit close button — guaranteed dismissal */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        aria-label="Close"
        className="absolute top-5 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <AnimatePresence>
          {showParticles && particles.map((p) => (
            <Particle key={`${currentIndex}-${p.id}`} x={p.x} y={p.y} color={p.color} />
          ))}
        </AnimatePresence>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="relative z-10 flex flex-col items-center gap-5 max-w-xs w-full px-6"
          initial={{ scale: 0.5, y: 60, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 1.1, y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          {/* Glow ring */}
          <motion.div
            className={`absolute w-56 h-56 rounded-full bg-gradient-to-br ${currentBadge.theme} blur-3xl opacity-40`}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          />

          {/* Badge label */}
          <motion.p
            className="relative text-xs font-black uppercase tracking-[0.25em] text-white/60"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Badge Unlocked
          </motion.p>

          {/* Badge image */}
          <motion.div
            className="relative"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <Image
              src={currentBadge.image}
              alt={currentBadge.name}
              width={200}
              height={200}
              className="relative drop-shadow-2xl"
              priority
            />
          </motion.div>

          {/* Name */}
          <motion.h2
            className="relative text-4xl font-black text-white tracking-tight text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.4)' }}
          >
            {currentBadge.name}
          </motion.h2>

          {/* Description */}
          <motion.p
            className="relative text-sm text-white/50 font-medium text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {currentBadge.description}
          </motion.p>

          {/* Tap hint */}
          <motion.p
            className="relative text-[10px] text-white/30 uppercase tracking-widest font-bold"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {currentIndex < badgeNames.length - 1 ? 'Tap for next' : 'Tap to continue'}
          </motion.p>

          {/* Dots for multiple badges */}
          {badgeNames.length > 1 && (
            <div className="relative flex gap-1.5">
              {badgeNames.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
