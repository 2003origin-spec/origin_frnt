'use client';
import { useState, useEffect } from 'react';
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
          <img src={event.image} alt={event.title} className="w-full h-full object-cover opacity-80 mix-blend-overlay dark:opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#020617] dark:via-[#020617]/80 dark:to-transparent" />
          <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end">
            <span className="inline-block px-3 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/20 rounded-full text-[10px] font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-300 w-fit mb-3 shadow-sm">
              {event.date}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-black dark:text-white mb-2 tracking-tight drop-shadow-sm">{event.title}</h2>
            <p className="text-sm text-black/80 dark:text-slate-300 max-w-lg leading-relaxed">{event.description}</p>
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-300 relative overflow-x-hidden">
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.3) 0%, transparent 40%),
                               radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.15) 0%, transparent 40%)`
        }}>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <EventsCarousel />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="h-auto lg:h-[280px]">
              <DailyTracker user={user} />
            </div>
            <div className="h-auto lg:h-[180px]">
              <PastWeekProgress user={user} />
            </div>
            <PastActivitiesCard user={user} />
            <PlacesToConcentrateCard user={user} />
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <ChallengeCard user={user} onStartChallenge={onStartChallenge} />
            <PointsSummary data={pointsData} onNextSteps={() => onNavigate('prestige-milestones')} />
            <div className="h-[408px]">
              <TodoListCard 
                tasks={tasks}
                onAddTask={onAddTask}
                onToggleTask={onToggleTask}
                onRemoveTask={onRemoveTask}
                onViewAll={() => onNavigate('tasks-goals')}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
