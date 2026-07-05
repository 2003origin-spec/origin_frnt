'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import LandingCTABtn from '@/components/landing/LandingCTABtn';
import { TrendingUp, Clock, Trophy, Calendar } from 'lucide-react';

// JEE Main ~11 lakh candidates; AIR derived from percentile
function estimateAIR(percentile: number): number {
  return Math.max(1, Math.ceil(1_100_000 * (1 - percentile / 100)));
}

function formatAIR(air: number): string {
  if (air >= 100_000) return `${(air / 100_000).toFixed(1)}L`;
  if (air >= 1_000) return `${Math.round(air / 1_000)}K`;
  return `${air}`;
}

function predictPercentile(hoursPerDay: number, mockScore: number, monthsLeft: number): number {
  const h = Math.min(hoursPerDay / 12, 1);
  const s = Math.min(mockScore / 100, 1);
  const m = Math.min(monthsLeft / 18, 1);
  const raw = 0.25 * h + 0.65 * s + 0.10 * m;
  const sigmoid = 1 / (1 + Math.exp(-15 * (raw - 0.5)));
  return Math.min(Math.round(20 + sigmoid * 80), 99);
}

function improvementDelta(base: number): number {
  return Math.min(Math.round(3 + (100 - base) * 0.12), 15);
}

function PercentileDial({ percentile, air }: { percentile: number; air: number }) {
  const prefersReduced = useReducedMotion();
  const cx = 100; const cy = 100; const r = 72;
  const startAngle = 215; const totalSweep = 290;

  function polarToXY(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(from: number, to: number, radius: number) {
    const s = polarToXY(from); const e = polarToXY(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endAngle = startAngle + totalSweep;
  const filled = startAngle + (percentile / 100) * totalSweep;
  const needleTarget = startAngle + (percentile / 100) * totalSweep;
  const needleTip = polarToXY(needleTarget);
  const color = percentile >= 90 ? '#10b981' : percentile >= 70 ? '#0066ff' : percentile >= 50 ? '#f59e0b' : '#ef4444';
  const gradId = `dial-fill-${Math.round(percentile)}`;

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[280px]" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
      {/* Fill */}
      <path d={arcPath(startAngle, filled, r)} fill="none" stroke={`url(#${gradId})`} strokeWidth="12" strokeLinecap="round" filter="url(#glow)" />
      {/* Needle */}
      <motion.line
        x1={cx} y1={cy}
        initial={{ x2: needleTip.x, y2: needleTip.y }}
        animate={{ x2: needleTip.x, y2: needleTip.y }}
        transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20 }}
        stroke={color} strokeWidth="3" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="6" fill={color} />
      <circle cx={cx} cy={cy} r="3" fill="white" />
      {/* Labels */}
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="28" fontWeight="900" fill="white" fontFamily="inherit">
        {percentile}<tspan fontSize="13" fontWeight="700">th</tspan>
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="rgba(255,255,255,0.45)" fontFamily="inherit" letterSpacing="1.5">
        PERCENTILE
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fontWeight="700" fill={color} fontFamily="inherit" letterSpacing="0.5">
        AIR ~{formatAIR(air)}
      </text>
    </svg>
  );
}

export default function RankPredictor() {
  const [hours, setHours] = useState(7);
  const [score, setScore] = useState(95);
  const [months, setMonths] = useState(3);

  const percentile = predictPercentile(hours, score, months);
  const delta = improvementDelta(percentile);
  const improved = Math.min(percentile + delta, 99);
  const air = estimateAIR(percentile);
  const improvedAir = estimateAIR(improved);

  const zoneLabel = percentile >= 90 ? 'Elite Zone' : percentile >= 70 ? 'Strong Track' : percentile >= 50 ? 'On the Way' : 'Start Now';
  const zoneColor = percentile >= 90 ? '#10b981' : percentile >= 70 ? '#0066ff' : percentile >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <section id="rank-predictor" className="py-10 sm:py-16 lg:py-20 relative z-10">
      <div className="max-w-5xl mx-auto px-5 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 neu-inset px-4 py-2 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase">Rank Predictor</span>
          </div>
          <h2 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] mb-4">
            <span className="text-outline">Where will you</span><br />
            <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">rank?</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            Set your study plan and see where consistent effort with Ori takes you.
          </p>
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true, margin: '-80px' }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #060d1f 100%)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Blue ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[40%] h-[40%] rounded-full blur-[80px] opacity-20"
              style={{ background: 'radial-gradient(circle, #0066ff, transparent)' }} />
            <div className="absolute bottom-0 right-1/4 w-[30%] h-[30%] rounded-full blur-[60px] opacity-10"
              style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
          </div>

          <div className="relative grid md:grid-cols-[1fr_auto_1fr] gap-0">

            {/* Left: sliders */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-8">
              <SliderField
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Study hours / day"
                value={hours} min={1} max={12} step={1}
                format={(v) => `${v}h`}
                onChange={setHours}
              />
              <SliderField
                icon={<Trophy className="w-3.5 h-3.5" />}
                label="Latest mock score"
                value={score} min={0} max={100} step={5}
                format={(v) => `${v}%`}
                onChange={setScore}
              />
              <SliderField
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="Months until exam"
                value={months} min={1} max={18} step={1}
                format={(v) => `${v}mo`}
                onChange={setMonths}
              />
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px self-stretch my-8 bg-white/[0.06]" />

            {/* Right: dial + results */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col items-center justify-center gap-5 border-t border-white/[0.06] md:border-t-0">
              <div className="relative">
                <PercentileDial percentile={percentile} air={air} />
                {/* Zone pill */}
                <motion.div
                  key={zoneLabel}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap"
                  style={{ background: `${zoneColor}22`, border: `1px solid ${zoneColor}55`, color: zoneColor }}
                >
                  {zoneLabel}
                </motion.div>
              </div>

              {/* With Origin uplift */}
              <motion.div
                key={percentile}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="w-full rounded-2xl p-4 text-center"
                style={{ background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.2)' }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">With Ori</span>
                </div>
                <p className="text-white/70 text-xs leading-relaxed">
                  You can reach{' '}
                  <span className="text-white font-black">{improved}th percentile</span>
                  {' '}— AIR{' '}
                  <span className="text-primary font-black">~{formatAIR(improvedAir)}</span>
                </p>
              </motion.div>

              <LandingCTABtn label="See the full curve" href="/auth/register" variant="sm" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SliderField({
  icon, label, value, min, max, step, format, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/50">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-sm font-black text-white tabular-nums">{format(value)}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-thumb]]:bg-white"
      />
    </div>
  );
}
