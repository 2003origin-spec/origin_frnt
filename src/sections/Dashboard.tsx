'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, ViewState } from '@/types';
import DailyTracker from '@/components/dashboard/DailyTracker';
import PastWeekProgress from '@/components/dashboard/PastWeekProgress';
import { ChallengeCard, PastActivitiesCard, PlacesToConcentrateCard, TodoListCard } from '@/components/dashboard/DashboardCards';
import PointsSummary from '@/components/dashboard/PointsSummary';
import { apiCall } from '@/lib/api';
import type { TimeType } from '@/hooks/useTimeTracker';

const MOCK_EVENTS = [
  { id: 1, title: 'Grand Mastery Test III', description: 'Compete nationwide in this ultimate simulation for JEE Advanced 2026', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop', date: 'March 15, 2026' },
  { id: 2, title: 'Physics Olympiad Prep', description: 'Exclusive problem-solving session with former IPhO gold medalists', image: 'https://images.unsplash.com/photo-1636466497217-26c8cba22b10?q=80&w=800&auto=format&fit=crop', date: 'March 20, 2026' },
  { id: 3, title: 'Calculus Marathon', description: '12-hour continuous problem-solving streaming event', image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop', date: 'April 5, 2026' },
];

function EventsCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % MOCK_EVENTS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[200px] sm:h-[260px] rounded-3xl overflow-hidden group border border-slate-200/50 dark:border-slate-800/50 shadow-2xl">
      {MOCK_EVENTS.map((event, idx) => (
        <div
          key={event.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === current ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <img src={event.image} alt={event.title} className="w-full h-full object-cover opacity-60 dark:opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50/80 via-white/40 to-transparent dark:from-background dark:via-background/60 dark:to-transparent" />
          <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-center">
            <span className="inline-block px-3 py-1 bg-blue-100/50 dark:bg-white/10 backdrop-blur-md border border-blue-200/50 dark:border-white/20 rounded-full text-[10px] font-black tracking-widest uppercase text-[#1D4ED8] dark:text-indigo-300 w-fit mb-4 shadow-sm">
              {event.date}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-[#334155] dark:text-white mb-2 sm:mb-3 tracking-tight leading-tight max-w-2xl">{event.title}</h2>
            <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 max-w-xl leading-relaxed font-medium line-clamp-2 sm:line-clamp-none">{event.description}</p>
          </div>
        </div>
      ))}

      {/* Navigation Dots */}
      <div className="absolute bottom-6 right-6 flex gap-2">
        {MOCK_EVENTS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-indigo-600 dark:bg-indigo-500 shadow-sm' : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'}`}
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
  tasks: any[];
  onAddTask: (text: string, due: string) => void;
  onToggleTask: (id: number) => void;
  onRemoveTask: (id: number) => void;
}

export default function Dashboard({ user, onStartChallenge, setTimeMode, onNavigate, tasks, onAddTask, onToggleTask, onRemoveTask }: DashboardProps) {
  const [pointsData, setPointsData] = useState<{ totalPoints: number; currentTier: string; nextTier: string; pointsToNext: number; progressPercent: number; recentLogs: { points: number; type: string; description: string; timestamp: string }[] } | null>(null);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const data = await apiCall('/users/points/');
        setPointsData(data);
      } catch (err) {
        console.error("Failed to fetch points", err);
      }
    };
    fetchPoints();
  }, []);

  useEffect(() => {
    setTimeMode('webpage');
  }, [setTimeMode]);

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-500 relative overflow-x-hidden">
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-20">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-100 dark:bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-slate-100 dark:bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay" />
      </div>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <motion.div
          id="tutorial-events"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <EventsCarousel />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Main Content Grid (8/4 split for primary activity) */}
          <div className="lg:col-span-8 flex flex-col gap-6 sm:gap-8">
            <div id="tutorial-tracker" className="h-auto">
              <DailyTracker user={user} />
            </div>
            <div id="tutorial-progress" className="h-auto">
              <PastWeekProgress user={user} />
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6 sm:gap-8">
            <div id="tutorial-challenge">
              <ChallengeCard user={user} onStartChallenge={onStartChallenge} />
            </div>
            <div id="tutorial-points">
              <PointsSummary data={pointsData} onNextSteps={() => onNavigate('prestige-milestones')} />
            </div>
          </div>
        </div>

        {/* Insights & Tasks Layer (Wider for better visibility) */}
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div id="tutorial-activities">
              <PastActivitiesCard user={user} />
            </div>
            <div id="tutorial-focus">
              <PlacesToConcentrateCard user={user} />
            </div>
          </div>

          <div id="tutorial-todo" className="w-full">
            <TodoListCard 
              tasks={tasks}
              onAddTask={onAddTask}
              onToggleTask={onToggleTask}
              onRemoveTask={onRemoveTask}
              onViewAll={() => onNavigate('tasks-goals')}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
