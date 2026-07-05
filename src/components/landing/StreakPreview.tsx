'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Flame, Zap, Star } from 'lucide-react';
import LandingCTABtn from '@/components/landing/LandingCTABtn';

const MAX_STREAK = 47;
const XP_TARGET = 78;

// Confetti burst
function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colors = ['#0066ff', '#10b981', '#f59e0b', '#ec4899', '#ffffff'];
    particles.current = Array.from({ length: 80 }, () => ({
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 5 + 2, alpha: 1,
    }));
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.alpha -= 0.018;
        if (p.alpha > 0) { alive = true; ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
      }
      ctx.globalAlpha = 1;
      if (alive) rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return <canvas ref={canvasRef} width={300} height={200} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

function HeatCell({ active, delay, col }: { active: boolean; delay: number; col: number }) {
  const intensity = active ? (col > 15 ? 1 : col > 10 ? 0.8 : col > 5 ? 0.55 : 0.35) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: active ? 1 : 0.1, scale: 1 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
      className="w-full aspect-square rounded-[2px]"
      style={{
        background: active
          ? `rgba(0,102,255,${intensity})`
          : 'rgba(255,255,255,0.06)',
      }}
    />
  );
}

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

export default function StreakPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const prefersReduced = useReducedMotion();

  const [streak, setStreak] = useState(1);
  const [xp, setXp] = useState(0);
  const [levelUp, setLevelUp] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!inView || prefersReduced) {
      if (prefersReduced) { setStreak(MAX_STREAK); setXp(XP_TARGET); }
      return;
    }
    const duration = 2500;
    const start = Date.now();
    let raf: number;
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStreak(Math.round(1 + eased * (MAX_STREAK - 1)));
      setXp(Math.round(eased * XP_TARGET));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLevelUp(true);
        setTimeout(() => setConfetti(true), 300);
        setTimeout(() => { setConfetti(false); setLevelUp(false); }, 2500);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, prefersReduced]);

  // 7 rows × 20 cols
  const heatmapCells = Array.from({ length: 7 * 20 }, (_, i) => {
    const col = i % 20;
    return col < Math.floor((streak / MAX_STREAK) * 20);
  });

  return (
    <section className="py-10 sm:py-16 lg:py-20 relative z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_70%,rgba(0,102,255,0.05),transparent)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full mb-5">
            <span className="text-sm">🔥</span>
            <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase">Streak System</span>
          </div>
          <h2 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95]">
            <span className="text-outline">Day 48 is</span><br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">waiting for you.</span>
          </h2>
        </motion.div>

        <div ref={ref} className="grid md:grid-cols-2 gap-5 sm:gap-8 items-stretch">

          {/* Left: streak card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden flex flex-col min-h-[420px]"
            style={{
              background: 'linear-gradient(135deg, #0a0a0f, #120d00)',
              boxShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 24px 48px rgba(0,0,0,0.4)',
            }}
          >
            <ConfettiBurst active={confetti} />

            {/* Amber glow backdrop — large and centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full blur-[80px] opacity-25"
                style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />
            </div>

            <div className="relative flex flex-col h-full p-7 sm:p-8">

              {/* Hero: flame + counter — centered, fills available vertical space */}
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
                <motion.div
                  animate={inView && !prefersReduced ? { scale: [1, 1.2, 0.95, 1.1, 1], rotate: [0, -12, 12, -6, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="text-[80px] sm:text-[100px] leading-none select-none"
                >
                  🔥
                </motion.div>
                <div className="text-[80px] sm:text-[100px] font-black text-white tabular-nums leading-none tracking-tighter">
                  {streak}
                </div>
                <div className="text-xs text-amber-400/70 font-black uppercase tracking-[0.3em] mt-1">
                  Day Streak
                </div>
              </div>

              {/* XP bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-wider">XP Progress</span>
                  </div>
                  <span className="text-xs font-black text-amber-400 tabular-nums">{xp}%</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${xp}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                      boxShadow: '0 0 8px rgba(245,158,11,0.5)',
                    }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-white/25 font-medium">Level 7</span>
                  <span className="text-[10px] text-white/25 font-medium">Level 8</span>
                </div>
              </div>

              {/* Badges row — centered */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { icon: '⚡', label: '7-day win', active: streak >= 7 },
                  { icon: '🌟', label: '30-day', active: streak >= 30 },
                  { icon: '💎', label: '47-day', active: streak >= 47 },
                ].map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300"
                    style={b.active ? {
                      background: 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      color: '#f59e0b',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.2)',
                    }}
                  >
                    <span>{b.icon}</span> {b.label}
                  </div>
                ))}
              </div>

              {/* Level up badge */}
              <AnimatePresence>
                {levelUp && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.8 }}
                    className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-black text-amber-400 uppercase tracking-wider">Level Up!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right: heatmap — dark card matching RankPredictor */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden flex flex-col justify-between p-6 sm:p-8 gap-6 min-h-[420px]"
            style={{
              background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #060d1f 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-1/4 w-[40%] h-[40%] rounded-full blur-[80px] opacity-15"
                style={{ background: 'radial-gradient(circle, #0066ff, transparent)' }} />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-amber-400" />
                <p className="text-xs font-black text-white uppercase tracking-widest">Study Calendar</p>
              </div>
              <p className="text-xs text-white/40 font-medium">Your consistency, visualised</p>
            </div>

            {/* Month labels + heatmap */}
            <div className="relative flex-1 flex flex-col justify-center">
              <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${MONTHS.length}, 1fr)` }}>
                {MONTHS.map((m) => (
                  <span key={m} className="text-[9px] font-black text-white/30 uppercase tracking-wider">{m}</span>
                ))}
              </div>

              {/* Heatmap grid */}
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }}>
                {heatmapCells.map((active, i) => (
                  <HeatCell
                    key={i}
                    active={active && inView}
                    col={i % 20}
                    delay={inView ? (i % 20) * 0.018 : 0}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30 font-medium">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'rgba(255,255,255,0.06)' }} /> Less</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: 'rgba(0,102,255,0.4)' }} /></span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] inline-block bg-primary" /> More</span>
              </div>
            </div>

            {/* Stat + CTA */}
            <div className="relative space-y-4">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.2)' }}>
                <p className="text-sm text-white/60 font-medium leading-relaxed">
                  Students who hit a <span className="text-white font-black">30-day streak</span> see an average{' '}
                  <span className="text-primary font-black">+12 percentile</span> gain on their next mock.
                </p>
              </div>
              <LandingCTABtn label="Start your streak today" href="/auth/register" variant="sm" className="w-full" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
