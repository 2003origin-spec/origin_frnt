'use client';
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronLeft, ChevronRight, Flame, BookOpen, TrendingUp, Award, BarChart3, X } from 'lucide-react';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
import type { Task, User, ViewState } from '@/types';
import DailyTracker from '@/components/dashboard/DailyTracker';
import PastWeekProgress from '@/components/dashboard/PastWeekProgress';
import {
  ChallengeCard,
  type DashboardChallengePreview,
  PastActivitiesCard,
  TodoListCard,
} from '@/components/dashboard/DashboardCards';
import PointsSummary from '@/components/dashboard/PointsSummary';
import { apiCall } from '@/lib/api';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import type { TimeType } from '@/hooks/useTimeTracker';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';
import { BADGE_TIERS } from '@/lib/badges';

const SLIDES = [
  { id: 1, title: 'Welcome',             image: '/carousel/Welcome.png'             },
  { id: 2, title: 'Announcement',        image: '/carousel/Announcement-date.png'   },
  { id: 3, title: 'Announcement',        image: '/carousel/Announcement-date-2.png' },
  { id: 4, title: 'Legendary',           image: '/carousel/Legendary.png'           },
];

function EventsCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent(c => (c - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setCurrent(c => (c + 1) % SLIDES.length);

  return (
    <div className="relative w-full overflow-hidden group rounded-[var(--neu-radius)]" style={{ aspectRatio: '2172 / 724' }}>
      {SLIDES.map((slide, idx) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${idx === current ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            sizes="100vw"
            className="object-contain"
            priority={idx === 0}
            loading={idx === 0 ? 'eager' : 'lazy'}
          />
        </div>
      ))}

      {/* ← prev arrow */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 neu-btn p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
      >
        <ChevronLeft className="w-4 h-4 text-foreground" />
      </button>

      {/* → next arrow */}
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 neu-btn p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200"
      >
        <ChevronRight className="w-4 h-4 text-foreground" />
      </button>

      {/* dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 neu-inset px-3 py-2 rounded-full">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60'}`}
          />
        ))}
      </div>
    </div>
  );
}

interface DashboardProps {
  user: User;
  onStartChallenge: (questionId: string) => void;
  setTimeMode: (mode: TimeType, subject?: string) => void;
  onNavigate: (view: ViewState) => void;
  tasks: Task[];
  onAddTask: (text: string, due: string) => void;
  onEditTask: (id: string, text: string) => void;
  onToggleTask: (id: string) => void;
  onRemoveTask: (id: string) => void;
  initialPointsData?: {
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null;
  initialChallenge?: DashboardChallengePreview | null;
  initialRegStatus?: { count: number; limit: number; seatsLeft: number } | null;
}

import { useNotifications } from '@/context/NotificationContext';
import { TIER_THRESHOLDS, getUserTitle } from '@/lib/achievements';
import { useRef } from 'react';

const stagger = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: 0.06 * i } });

export default function Dashboard({
  user,
  onStartChallenge,
  setTimeMode,
  onNavigate,
  tasks,
  onAddTask,
  onEditTask,
  onToggleTask,
  onRemoveTask,
  initialPointsData = null,
  initialChallenge = null,
  initialRegStatus = null,
}: DashboardProps) {
  const { addNotification } = useNotifications();
  const [pointsData, setPointsData] = useState<{
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null>(initialPointsData);
  
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(initialRegStatus);

  // Live practice stats from the backend (solved count, streak, rank, accuracy).
  const [userStats, setUserStats] = useState<{
    solvedCount: number;
    streak: number;
    rank: number | null;
    accuracy: number;
  } | null>(null);

  useEffect(() => {
    // Server already seeded this on the dashboard page — skip the client fetch.
    if (initialRegStatus) return;
    const fetchRegStatus = async () => {
      const status = await getRegistrationStatusAction();
      setRegStatus(status);
    };
    fetchRegStatus();
  }, [initialRegStatus]);

  const prevTierRef = useRef<string | null>(pointsData?.currentTier || null);
  const achievementsRef = useRef<Record<string, boolean>>({});

  const { availableWidth } = useLayout();
  const isConstrained = availableWidth < 1024;

  // Track tier changes for notifications
  useEffect(() => {
    if (pointsData?.currentTier) {
      if (prevTierRef.current && prevTierRef.current !== pointsData.currentTier) {
        const newTier = TIER_THRESHOLDS.find(t => t.tier === pointsData.currentTier);
        if (newTier) {
          addNotification({
            title: 'Rank Up! 🏆',
            message: `Amazing! You've ascended to the ${newTier.tier} rank. Your dedication is paying off!`,
            type: 'success'
          });
        }
      }
      prevTierRef.current = pointsData.currentTier;
    }
  }, [pointsData?.currentTier, addNotification]);

  useEffect(() => {
    if (initialPointsData) {
      return;
    }

    const fetchPoints = async () => {
      try {
        const data = await apiCall('/users/points/', { silentAuth: true });
        setPointsData(data);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Session expired')) {
          console.warn("[Dashboard] Session expired during background points fetch.");
        } else {
          console.error("Failed to fetch points", err);
        }
      }
    };
    fetchPoints();
  }, [initialPointsData]);

  // Welcome notification & Achievement tracking
  useEffect(() => {
    if (!user) return;

    // 1. Daily Welcome
    const today = new Date().toISOString().split('T')[0];
    const lastWelcome = localStorage.getItem(`welcome_${user.id}`);
    
    if (lastWelcome !== today) {
      const title = getUserTitle(user);
      // greeting is derived from useMemo above
      const name = user.name.split(' ')[0];
      
      addNotification({
        title: `${greeting}, ${title ? title + ' ' : ''}${name}! 👋`,
        message: `Welcome back to Ori. Ready to push your boundaries today?`,
        type: 'info'
      });
      localStorage.setItem(`welcome_${user.id}`, today);
    }

    // 2. Poll for stats/achievements periodically
    const checkAchievements = async () => {
      try {
        const stats = await apiCall('/assessments/ogcode/user-stats/', { silentAuth: true });
        setUserStats({
          solvedCount: Number(stats.solvedCount ?? 0),
          streak: Number(stats.streak ?? 0),
          rank: stats.rank ?? null,
          accuracy: Number(stats.accuracy ?? 0),
        });
        const newAchievements = stats.achievements || {};
        
        // Initial load - don't notify
        if (Object.keys(achievementsRef.current).length === 0) {
          achievementsRef.current = newAchievements;
          return;
        }

        // Check for new unlocks
        Object.entries(newAchievements).forEach(([key, unlocked]) => {
          if (unlocked && !achievementsRef.current[key]) {
            const achievementNames: Record<string, string> = {
              streak_7: '7-Day Streak! 🔥',
              streak_30: 'Monthly Warrior! 🛡️',
              streak_100: 'Centurion! 💯',
              perfect_score: 'Perfect Score! 🎯',
              subject_master: 'Subject Master! 🧠',
              doubt_master: 'Doubt Resolver! 💡',
            };

            if (achievementNames[key]) {
              addNotification({
                title: 'Achievement Unlocked!',
                message: achievementNames[key],
                type: 'success'
              });
            }
          }
        });
        achievementsRef.current = newAchievements;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Session expired')) {
          console.warn("[Dashboard] Session expired during achievement poll.");
        } else {
          console.error("Failed to check achievements", err);
        }
      }
    };

    checkAchievements();
    const interval = setInterval(checkAchievements, 60000 * 5); // Check every 5 mins
    return () => clearInterval(interval);
  }, [user, addNotification]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  useEffect(() => {
    setTimeMode('webpage');
  }, [setTimeMode]);

  const displayName = getUserTitle(user)
    ? `${getUserTitle(user)} ${user.name.split(' ')[0]}`
    : user.name.split(' ')[0];

  /* ── Derived stats ─────────────────────────────────────────────── */
  // Canonical streak: DB-backed user.streak, overridden by live userStats if available.
  // All other streak displays (OGCodeList, DailyTracker, Profile) use user.streak — keep in sync.

  const totalSolved = useMemo(() =>
    (user.contributionData || []).reduce((sum, c) => sum + (c.count || 0), 0),
    [user.contributionData]
  );

  const todayStudyMins = useMemo(() => {
    const analytics = user.timeAnalytics || [];
    if (!analytics.length) return 0;
    const t = analytics[analytics.length - 1] as { practiceTime?: number; webpageTime?: number; pomodoroTime?: number };
    return Math.floor(((t.practiceTime || 0) + (t.webpageTime || 0) + (t.pomodoroTime || 0)) / 60);
  }, [user.timeAnalytics]);

  const [badgeZoom, setBadgeZoom] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const currentBadgePts = pointsData?.totalPoints ?? user.points ?? 0;
  const currentBadge = [...BADGE_TIERS].reverse().find(b => currentBadgePts >= b.points) ?? BADGE_TIERS[0];

  // stagger is defined at module scope — see below the component

  return (
    <div className="min-h-screen neu-surface font-sans selection:bg-primary/20 selection:text-primary">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 flex flex-col gap-4">

        {/* ── Seats banner ──────────────────────────────────────── */}
        {regStatus && regStatus.seatsLeft > 0 && regStatus.seatsLeft <= 50 && (
          <motion.div {...stagger(0)} className="neu-raised px-4 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs font-bold text-foreground min-w-0">
                Only <span className="text-primary font-black">{regStatus.seatsLeft}</span> of {regStatus.limit} seats left.
              </p>
            </div>
            <NeuButton accent onClick={() => window.open('https://chat.whatsapp.com/L7X7N7P7N7P7N7P7N7P7N7', '_blank')} className="text-xs font-black uppercase tracking-tighter shrink-0">
              Invite
            </NeuButton>
          </motion.div>
        )}

        {/* ── HERO ──────────────────────────────────────────────── */}
        <motion.div {...stagger(1)} id="tutorial-welcome" className="neu-raised p-5 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Left — greeting */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight break-words">
                  {greeting},<br className="sm:hidden" /> {displayName}!
                </h1>
                <Image src="/ori2d/ori-winking.png" alt="Ori" width={48} height={48} style={{ width: 'auto', height: 48 }} className="object-contain drop-shadow-md hidden sm:block" />
              </div>
              {pointsData && pointsData.pointsToNext > 0 && (
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  <span className="font-black text-foreground">{pointsData.pointsToNext.toLocaleString()}</span> pts away from{' '}
                  <span className="font-black text-primary">{pointsData.nextTier}</span>
                </p>
              )}
            </div>

            {/* Centre — highest unlocked badge derived directly from points */}
            <button
              onClick={() => setBadgeZoom(true)}
              className="relative w-[125px] h-[121px] flex items-center justify-center focus:outline-none"
              aria-label={`View ${currentBadge.name} badge`}
            >
              <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${currentBadge.theme} opacity-20 blur-xl`} />
              <motion.div
                className="relative w-full h-full"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <Image
                  src={currentBadge.image}
                  alt={currentBadge.name}
                  fill
                  sizes="125px"
                  className="object-contain drop-shadow-xl"
                  priority
                />
              </motion.div>
            </button>

            {/* Right — Ori mascot */}
            <div className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 justify-self-end">
              <OriMascot expression="winking" title="Ori" />
            </div>
          </div>

          {/* Points — minimal inline summary */}
          {pointsData && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  {pointsData.totalPoints.toLocaleString()} pts · {pointsData.currentTier}
                </span>
                <span className="text-xs font-black text-primary">
                  {pointsData.pointsToNext > 0 ? `+${pointsData.pointsToNext.toLocaleString()} → ${pointsData.nextTier}` : '✦ Max rank'}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden neu-inset">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pointsData.progressPercent)}%` }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={() => onNavigate('prestige-milestones')}
                  className="text-[10px] font-black text-primary/60 hover:text-primary uppercase tracking-widest transition-colors"
                >
                  View Milestones →
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── CAROUSEL ──────────────────────────────────────────── */}
        <motion.div {...stagger(2)} id="tutorial-events">
          <EventsCarousel />
        </motion.div>

        {/* ── QUICK STATS STRIP + progress trigger ──────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(() => {
            const solved = userStats?.solvedCount ?? totalSolved;
            const streak = userStats?.streak ?? user.streak ?? 0;
            return [
              { icon: BookOpen,   color: 'text-emerald-500', label: 'Solved',     value: solved.toLocaleString(), showOri: false },
              { icon: Flame,      color: 'text-orange-500',  label: 'Day Streak', value: streak > 0 ? String(streak) : '—', showOri: streak > 0 },
              { icon: Award,      color: 'text-violet-500',  label: 'Rank',       value: pointsData?.currentTier ?? '—', showOri: false },
              { icon: TrendingUp, color: 'text-cyan-500',    label: 'Today',      value: todayStudyMins > 0 ? `${todayStudyMins}m` : '—', showOri: false },
            ];
          })().map((s, i) => (
            <motion.div key={s.label} {...stagger(i + 3)} className="neu-raised p-4 flex flex-col gap-1.5 min-w-0">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-black text-foreground leading-none truncate">{s.value}</p>
                {s.showOri && <Image src="/ori2d/ori-exited.png" alt="Ori" width={40} height={40} style={{ width: 'auto', height: 'auto', maxHeight: 40, maxWidth: 40 }} className="object-contain drop-shadow" />}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
          {/* Progress panel trigger — simple tile beside stats */}
          <motion.button
            {...stagger(7)}
            onClick={() => setPanelOpen(true)}
            className="neu-raised p-4 flex flex-col gap-1.5 min-w-0 group hover:bg-primary/5 transition-colors col-span-2 sm:col-span-1"
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-xl font-black text-primary leading-none">→</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progress</p>
          </motion.button>
        </div>

        {/* ── CHALLENGE ─────────────────────────────────────────── */}
        <motion.div {...stagger(9)} id="tutorial-challenge">
          <ChallengeCard user={user} initialChallenge={initialChallenge} onStartChallenge={onStartChallenge} />
        </motion.div>

        {/* ── TASKS ─────────────────────────────────────────────── */}
        <motion.div {...stagger(13)} id="tutorial-todo">
          <TodoListCard
            tasks={tasks}
            onAddTask={(text, due) => {
              onAddTask(text, due);
              addNotification({ title: 'Goal Set!', message: `"${text}" added to your goals.`, type: 'success' });
            }}
            onEditTask={onEditTask}
            onToggleTask={onToggleTask}
            onRemoveTask={onRemoveTask}
            onViewAll={() => onNavigate('tasks-goals')}
          />
        </motion.div>

      </div>

      {/* Progress & Activity left panel */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              key="panel-backdrop"
              className="fixed inset-0 z-[490] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setPanelOpen(false)}
            />
            <motion.div
              key="progress-panel"
              className="fixed left-0 md:left-[72px] top-14 md:top-0 bottom-14 md:bottom-0 z-[500] w-full md:w-[480px] bg-background border-r border-border shadow-2xl flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-foreground uppercase tracking-widest leading-none">Progress</h2>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Activity · Time · Sessions</p>
                  </div>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="neu-btn p-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                <DailyTracker user={user} />
                <PastWeekProgress user={user} />
                <PastActivitiesCard user={user} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Badge zoom overlay */}
      <AnimatePresence>
        {badgeZoom && (
          <motion.div
            key="badge-zoom"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setBadgeZoom(false)}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" />
            <motion.div
              className="relative z-10 flex flex-col items-center gap-5 pointer-events-none"
              initial={{ scale: 0.5, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className={`absolute w-72 h-72 rounded-full bg-gradient-to-br ${currentBadge.theme} blur-3xl opacity-35`} />
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Image
                  src={currentBadge.image}
                  alt={currentBadge.name}
                  width={260}
                  height={260}
                  className="relative drop-shadow-2xl"
                  style={{ height: 'auto' }}
                  priority
                />
              </motion.div>
              <h2
                className="relative text-4xl font-black text-white tracking-tight text-center"
                style={{ textShadow: '0 0 40px rgba(255,255,255,0.4)' }}
              >
                {currentBadge.name}
              </h2>
              <p className="relative text-sm text-white/50 font-medium text-center max-w-[200px]">
                {currentBadge.description}
              </p>
              <motion.p
                className="relative text-[10px] text-white/30 uppercase tracking-widest font-bold"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                Tap to close
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
