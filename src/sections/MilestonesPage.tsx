'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ChevronLeft, Trophy, Check, BookOpen, Target, MessageCircle, TrendingUp, Crown, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

interface MilestonesPageProps {
  onBack: () => void;
  userPoints: number;
}

import { TIER_THRESHOLDS } from '@/lib/achievements';
import { BADGE_TIERS } from '@/lib/badges';
import { MilestoneCabinet } from '@/components/badges/MilestoneCabinet';
import { totalQuestionsSolved } from '@/lib/milestone-badges';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const HOW_EARNED = [
  {
    icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Practice Questions', pts: 'Base × Speed + 5', rows: [
      { label: 'Easy Question', pts: '+11–19', note: 'Base 10 × speed (0.55–1.35×) + 5' },
      { label: 'Medium Question', pts: '+19–39', note: 'Base 25 × speed (0.55–1.35×) + 5' },
      { label: 'Hard Question', pts: '+33–73', note: 'Base 50 × speed (0.55–1.35×) + 5' },
      { label: 'Insane Question', pts: '+60–140', note: 'Base 100 × speed (0.55–1.35×) + 5' },
      { label: 'Solve faster to earn more', pts: '↑', note: 'Full points ≤ ½ target time; only your first solve counts.' },
    ]
  },
  {
    icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', label: 'Completing Tests', pts: '+4 pts/correct', rows: [
      { label: 'Correct Answer', pts: '+4', note: 'Per question' },
      { label: 'Wrong Answer', pts: '−1', note: 'Negative marking' },
      { label: 'Unattempted', pts: '0', note: 'No penalty' },
    ]
  },
  {
    icon: MessageCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', label: 'AI Explainer', pts: '+5 pts/session', rows: [
      { label: 'Per AI session', pts: '+5', note: 'Capped at 25/day' },
    ]
  },
];

export default function MilestonesPage({ onBack, userPoints }: MilestonesPageProps) {
  const totalPoints = userPoints;
  const { user } = useAuth();
  const totalSolved = user ? totalQuestionsSolved(user) : 0;
  const [activeTab, setActiveTab] = useState<'milestones' | 'how'>('milestones');
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const currentTier = [...TIER_THRESHOLDS].reverse().find(t => totalPoints >= t.min) || TIER_THRESHOLDS[0];
  const currentBadge = BADGE_TIERS.find(b => b.name === currentTier.tier);
  const unlockedCount = BADGE_TIERS.filter(b => totalPoints >= b.points).length;

  return (
    <div className="min-h-screen neu-surface text-foreground relative overflow-x-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/30 bg-[hsl(var(--neu-bg))] backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 neu-raised rounded-full hover:-translate-y-0.5 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <img src="/ori2d/ori-proud.png" alt="Ori" className="w-16 h-16 object-contain drop-shadow-md" />
            <div>
              <h1 className="text-xl font-black text-foreground">Prestige Journey</h1>
              <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest">Your path to greatness</p>
            </div>
          </div>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-2 px-4 py-2 neu-raised rounded-2xl">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-sm font-black text-primary">{totalPoints.toLocaleString()} pts</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-10 relative z-10">

        {/* Current Rank Hero — now with badge image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'neu-raised rounded-[32px] p-4 sm:p-6 mb-6 sm:mb-8 relative overflow-hidden',
            currentTier.border ? `ring-1 ${currentTier.border}` : ''
          )}
        >
          <div className={cn('absolute top-0 right-0 w-48 h-48 blur-[70px] opacity-15 pointer-events-none', currentTier.bg)} />

          <div className="flex items-center gap-5 mb-4">
            {/* Badge image */}
            <div className="relative shrink-0 w-20 h-20">
              {currentBadge ? (
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                >
                  <Image
                    src={currentBadge.image}
                    alt={currentBadge.name}
                    width={80}
                    height={80}
                    className="drop-shadow-xl"
                    priority
                  />
                </motion.div>
              ) : (
                <div className="w-20 h-20 shrink-0">
                  <OriMascot expression="proud" title="Ori" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Rank</p>
              <h2 className={cn('text-2xl sm:text-3xl font-black', currentTier.color)}>{currentTier.tier}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {unlockedCount} / {BADGE_TIERS.length} badges unlocked
              </p>
            </div>
          </div>

          {currentTier.next !== Infinity && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>{totalPoints.toLocaleString()} pts</span>
                <span>{(currentTier.next - totalPoints).toLocaleString()} pts to next rank</span>
              </div>
              <div className="w-full h-3 neu-inset rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((totalPoints - currentTier.min) / (currentTier.next - currentTier.min)) * 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                />
              </div>
            </div>
          )}

          {currentTier.next === Infinity && (
            <div className="flex items-center gap-2 mt-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-amber-400">You've reached the pinnacle! Stay on top.</p>
            </div>
          )}
        </motion.div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 neu-inset p-1 rounded-2xl">
          {(['milestones', 'how'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-[2px_2px_6px_hsl(var(--neu-shadow))]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'milestones' ? '🏆 Milestones' : '⚡ How to Earn'}
            </button>
          ))}
        </div>

        {/* Milestones list — badge-driven */}
        {activeTab === 'milestones' && (
          <div className="space-y-3">
            {/* Questions-solved milestone cabinet */}
            <div className="neu-raised rounded-2xl p-4 sm:p-5 mb-2">
              <MilestoneCabinet totalSolved={totalSolved} />
            </div>

            {BADGE_TIERS.map((badge, i) => {
              const tier = TIER_THRESHOLDS.find(t => t.tier === badge.name);
              const unlocked = totalPoints >= badge.points;
              const isCurrent = badge.name === currentTier.tier;
              const ptsNeeded = Math.max(0, badge.points - totalPoints);
              const isExpanded = expandedTier === badge.name;

              return (
                <motion.div
                  key={badge.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35 }}
                >
                  <button
                    onClick={() => setExpandedTier(isExpanded ? null : badge.name)}
                    className={cn(
                      'relative w-full flex items-center gap-4 p-4 rounded-[24px] transition-all text-left',
                      isCurrent
                        ? cn('neu-raised ring-1', tier?.border ?? 'border-primary/30')
                        : unlocked
                          ? 'neu-raised'
                          : 'neu-inset opacity-70'
                    )}
                  >
                    {/* Ori cheerful pop for unlocked */}
                    {isCurrent && (
                      <img
                        src="/ori2d/ori-cheerful.png"
                        alt="Ori"
                        className="w-8 h-8 object-contain absolute -top-2 -right-2 drop-shadow"
                      />
                    )}

                    {/* Badge image */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <Image
                        src={badge.image}
                        alt={badge.name}
                        width={56}
                        height={56}
                        className={cn(
                          'drop-shadow-md transition-all duration-300',
                          unlocked ? '' : 'grayscale opacity-40'
                        )}
                        style={{ height: 'auto' }}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-end justify-end pr-0.5 pb-0.5">
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn(
                          'text-sm font-black',
                          isCurrent
                            ? (tier?.color ?? 'text-primary')
                            : unlocked
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                        )}>
                          {badge.name}
                        </p>
                        {isCurrent && tier && (
                          <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full', tier.bg, tier.color)}>
                            Current
                          </span>
                        )}
                        {unlocked && !isCurrent && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                            Unlocked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {badge.points === 0 ? 'Starting rank' : `${badge.points.toLocaleString()} pts required`}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="text-right shrink-0">
                      {unlocked ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                          <Check className="w-4 h-4 text-emerald-400" />
                        </div>
                      ) : (
                        <div>
                          <p className={cn('text-sm font-black', tier?.color ?? 'text-primary')}>+{ptsNeeded.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">pts to unlock</p>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded description */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2 mt-1 mb-1 px-4 py-3 rounded-[16px] neu-inset text-[11px] text-muted-foreground italic">
                          {badge.description}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* How to Earn */}
        {activeTab === 'how' && (
          <div className="space-y-5">
            {HOW_EARNED.map((section, si) => (
              <motion.div
                key={section.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.1 }}
                className={cn('neu-raised rounded-[24px] p-5')}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', section.bg)}>
                    <section.icon className={cn('w-5 h-5', section.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">{section.label}</h3>
                    <p className={cn('text-[10px] font-bold', section.color)}>{section.pts}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {section.rows.map((row, ri) => (
                    <div key={ri} className="flex items-center justify-between py-2 border-t border-border/40">
                      <div>
                        <p className="text-[12px] font-bold text-foreground">{row.label}</p>
                        <p className="text-[10px] text-muted-foreground">{row.note}</p>
                      </div>
                      <span className={cn('text-sm font-black', row.pts.startsWith('−') ? 'text-rose-400' : row.pts === '0' ? 'text-muted-foreground' : section.color)}>
                        {row.pts}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="neu-raised rounded-[24px] p-5 ring-1 ring-amber-400/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-foreground">Pro Tips</h3>
              </div>
              <ul className="space-y-2">
                {[
                  'Solve Insane difficulty questions for maximum point gain.',
                  'First solve on every new question gives a +5 bonus.',
                  'Use the AI Explainer daily for guaranteed +25 pts/day.',
                  'Avoid wrong answers in tests — negative marking reduces points.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="text-amber-400 font-black mt-0.5">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
