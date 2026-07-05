'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, BarChart2, Users, Zap, GraduationCap, School } from 'lucide-react';
import LandingCTABtn from '@/components/landing/LandingCTABtn';

const STUDENT_POINTS = [
  { icon: Zap,       text: '24/7 AI mentor that remembers your history' },
  { icon: BookOpen,  text: '12,620+ curated JEE / NEET questions' },
  { icon: BarChart2, text: 'Real-time percentile + velocity tracking' },
  { icon: Users,     text: 'Live study rooms with peer presence' },
];

const TEACHER_POINTS = [
  { icon: Users,     text: 'Assign DPPs to your entire batch in 30 seconds' },
  { icon: BarChart2, text: 'Per-student analytics — see every weak topic' },
  { icon: BookOpen,  text: 'Custom test creation with AI grading' },
  { icon: Zap,       text: 'Connect billing + enrollment, automated' },
];

type Audience = 'student' | 'teacher';

// App window chrome wrapper — fixed-height panel, no image blowout
function AppFrame({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden"
      style={{ boxShadow: `0 0 0 1px ${accent}22, 0 24px 56px rgba(0,0,0,0.35)` }}>
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2.5"
        style={{ background: 'rgba(10,10,15,0.98)', borderBottom: `1px solid ${accent}18` }}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        <span className="ml-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: `${accent}80` }}>
          Ori
        </span>
      </div>
      <div style={{ background: 'rgba(10,10,15,0.98)' }}>
        {children}
      </div>
    </div>
  );
}

// Inline student chat mockup — no external image needed
function StudentChatMockup({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col gap-3 p-4 h-[268px] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: `1px solid ${accent}14` }}>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}20` }}>
          <img src="/ori2d/ori-happy.png" alt="" className="w-5 h-5 object-contain" />
        </div>
        <div>
          <div className="text-[11px] font-black text-white leading-none">Ori AI Mentor</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-[9px] text-emerald-400 font-medium">Online</span>
          </div>
        </div>
        <div className="ml-auto text-[9px] font-black px-2 py-1 rounded-full"
          style={{ background: `${accent}18`, color: accent }}>
          Physics · Ch 5
        </div>
      </div>

      {/* Student message */}
      <div className="flex justify-end">
        <div className="max-w-[76%] px-3 py-2 rounded-2xl rounded-tr-sm text-[11px] text-white font-medium leading-relaxed"
          style={{ background: accent }}>
          Explain Newton's 3rd law with a JEE example 🤔
        </div>
      </div>

      {/* Ori response */}
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${accent}15` }}>
          <img src="/ori2d/ori-happy.png" alt="" className="w-3.5 h-3.5 object-contain" />
        </div>
        <div className="flex-1 px-3 py-2.5 rounded-2xl rounded-tl-sm text-[11px] leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
          <span style={{ color: accent }} className="font-black">F₁₂ = –F₂₁.</span>
          {' '}Rocket expels gas backward → gas pushes rocket forward. Same magnitude, opposite direction — classic JEE MCQ setup.
        </div>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <span className="text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider"
          style={{ background: `${accent}18`, color: accent }}>⚡ Mechanics</span>
        <span className="text-[9px] px-2.5 py-1 rounded-full font-black text-emerald-400"
          style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)' }}>
          91% clarity match
        </span>
        <span className="text-[9px] px-2.5 py-1 rounded-full font-black text-white/40"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          4 related Qs →
        </span>
      </div>
    </div>
  );
}

// Inline teacher batch dashboard mockup
function TeacherDashMockup({ accent }: { accent: string }) {
  const students = [
    { name: 'Aarav S.', score: 88, weak: 'Optics', progress: 88 },
    { name: 'Priya K.', score: 74, weak: 'Thermodynamics', progress: 74 },
    { name: 'Rohan M.', score: 61, weak: 'Electrostatics', progress: 61 },
  ];
  return (
    <div className="flex flex-col gap-3 p-4 h-[268px] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: `1px solid ${accent}14` }}>
        <div>
          <div className="text-[11px] font-black text-white leading-none">Batch A — Physics</div>
          <div className="text-[9px] text-white/40 font-medium mt-0.5">42 students · 3 active DPPs</div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: accent }} />
          <span className="text-[9px] font-black" style={{ color: accent }}>Live</span>
        </div>
      </div>

      {/* Student rows */}
      <div className="flex flex-col gap-2 flex-1">
        {students.map((s) => (
          <div key={s.name} className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black text-white"
              style={{ background: `${accent}25` }}>
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-black text-white truncate">{s.name}</span>
                <span className="text-[10px] font-black tabular-nums" style={{ color: accent }}>{s.score}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: accent }} />
              </div>
            </div>
            <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-md shrink-0"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
              ↓ {s.weak}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom stat strip */}
      <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {[['14', 'Tests Set'], ['74%', 'Avg Score'], ['38', 'Active Now']].map(([val, label]) => (
          <div key={label} className="text-center">
            <div className="text-sm font-black" style={{ color: accent }}>{val}</div>
            <div className="text-[8.5px] text-white/35 font-medium">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function TeacherFlipCard() {
  const [active, setActive] = useState<Audience>('student');
  const isStudent = active === 'student';

  return (
    <section className="py-10 sm:py-16 lg:py-20 relative z-10 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[30%] h-[50%] rounded-full blur-[100px] opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #0066ff, transparent)' }} />
        <div className="absolute bottom-1/4 right-0 w-[30%] h-[50%] rounded-full blur-[100px] opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-10"
        >
          <span className="text-[10px] font-black text-primary tracking-[0.4em] uppercase block mb-4">
            Two Audiences, One Platform
          </span>
          <h2 className="text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
            <span className="text-outline">Built for</span>{' '}
            <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">both sides</span>{' '}
            <span className="text-outline">of the</span><br />
            <span className="text-outline">classroom.</span>
          </h2>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 p-1.5 rounded-full neu-inset">
            {(['student', 'teacher'] as Audience[]).map((a) => (
              <button
                key={a}
                onClick={() => setActive(a)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300"
                style={active === a ? {
                  background: a === 'student' ? '#0066ff' : '#10b981',
                  color: 'white',
                  boxShadow: `0 4px 16px ${a === 'student' ? 'rgba(0,102,255,0.4)' : 'rgba(16,185,129,0.4)'}`,
                } : {}}
              >
                {a === 'student'
                  ? <><GraduationCap className="w-3.5 h-3.5" /> For Students</>
                  : <><School className="w-3.5 h-3.5" /> For Teachers</>}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="grid md:grid-cols-2 gap-6 lg:gap-10 items-center"
          >
            {/* Left: feature list */}
            <div className="shine-card rounded-3xl neu-raised p-7 sm:p-8 lg:p-10 space-y-6 relative overflow-hidden">
              {/* Accent top stripe */}
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl"
                style={{ background: `linear-gradient(90deg, transparent, ${isStudent ? '#0066ff' : '#10b981'}, transparent)` }} />

              {/* Icon + heading */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: isStudent ? 'rgba(0,102,255,0.1)' : 'rgba(16,185,129,0.1)' }}>
                  {isStudent
                    ? <img src="/ori2d/ori-happy.png" alt="Student" className="w-8 h-8 object-contain" />
                    : <img src="/ori2d/ori-determined.png" alt="Teacher" className="w-8 h-8 object-contain" />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-1"
                    style={{ color: isStudent ? '#0066ff' : '#10b981' }}>
                    {isStudent ? 'Student Experience' : 'Teacher Dashboard'}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
                    {isStudent
                      ? 'Everything you need to crack JEE / NEET.'
                      : 'Run your batch like a top coaching centre.'}
                  </h3>
                </div>
              </div>

              {/* Feature list */}
              <div className="space-y-3.5">
                {(isStudent ? STUDENT_POINTS : TEACHER_POINTS).map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-none mt-0.5"
                      style={{ background: isStudent ? 'rgba(0,102,255,0.08)' : 'rgba(16,185,129,0.08)' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: isStudent ? '#0066ff' : '#10b981' }} />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">{text}</p>
                  </motion.div>
                ))}
              </div>

              <LandingCTABtn
                label={isStudent ? 'Start for free' : 'Set up your batch'}
                href={isStudent ? '/auth/register' : '/auth/register?role=teacher'}
                variant="sm"
              />
            </div>

            {/* Right: inline app mockup */}
            <div className="relative">
              {isStudent ? (
                <AppFrame accent="#0066ff">
                  <StudentChatMockup accent="#0066ff" />
                </AppFrame>
              ) : (
                <AppFrame accent="#10b981">
                  <TeacherDashMockup accent="#10b981" />
                </AppFrame>
              )}

              {/* Floating stat chip */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-2xl backdrop-blur-md"
                style={{
                  background: isStudent ? 'rgba(0,102,255,0.85)' : 'rgba(16,185,129,0.85)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <span className="text-base">{isStudent ? '🎯' : '📊'}</span>
                <div>
                  <div className="text-[11px] font-black text-white leading-tight">
                    {isStudent ? '99th Percentile' : '140+ Students'}
                  </div>
                  <div className="text-[9px] text-white/70 font-medium leading-tight">
                    {isStudent ? 'students reached' : 'managed on Origin'}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
