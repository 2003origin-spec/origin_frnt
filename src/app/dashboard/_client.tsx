'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Dashboard from '@/sections/Dashboard';
import StreakCelebration from '@/components/streak/StreakCelebration';
import type { DashboardChallengePreview } from '@/components/dashboard/DashboardCards';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';
import type { Task } from '@/types';
import type { ContestStatus } from '@/server/contest/contest-status';
import type { StreakTouchResult } from '@/server/streak-login';

interface DashboardClientProps {
  initialTasks: Task[];
  initialPointsData: {
    totalPoints: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPercent: number;
    recentLogs: { points: number; type: string; description: string; timestamp: string }[];
  } | null;
  initialChallenge: DashboardChallengePreview | null;
  initialRegStatus: { count: number; limit: number; seatsLeft: number } | null;
  initialContest: ContestStatus | null;
  /** First-login-of-the-day streak celebration signal (null when the flag is
   *  off or the overlay already fired today). Consumed by the Phase-4 overlay. */
  initialStreakCelebration: StreakTouchResult | null;
}

export default function DashboardClient({
  initialTasks,
  initialPointsData,
  initialChallenge,
  initialRegStatus,
  initialContest,
  initialStreakCelebration,
}: DashboardClientProps) {
  const { user, tasks, addTask, editTask, toggleTask, removeTask, primeTasks } = useAuth();
  const router = useRouter();
  const { setTimeMode } = useTimeTracker(!!user);

  // First-login-of-the-day streak flame. The server decides once per day whether
  // to celebrate; we render it, and it self-dismisses after ~1.2s.
  const [streak, setStreak] = useState(
    initialStreakCelebration?.celebrate ? initialStreakCelebration : null,
  );

  useEffect(() => {
    primeTasks(initialTasks);
  }, [initialTasks, primeTasks]);

  if (!user) return null;

  // Teachers and admins never see the student dashboard — the server already
  // redirects them (dashboard/page.tsx). This is a defensive client-side guard
  // that bounces them to the correct app instead of rendering student UI.
  if (user.role === 'teacher') {
    router.push('/teacher');
    return null;
  }

  if (user.role === 'admin') {
    router.push('/admin');
    return null;
  }

  const handleStartChallenge = (questionId: string) => {
    router.push(`/ogcode/${questionId}`);
  };

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'test-list': '/tests',
      'study-corner': '/study-corner',
      'ogcode': '/ogcode',
      'tasks-goals': '/tasks',
      'profile': '/profile',
      'pomodoro': '/pomodoro',
      'leaderboard': '/leaderboard',
      'prestige-milestones': '/milestones',
    };
    router.push(routes[view] || `/${view}`);
  };

  return (
    <>
      <Dashboard
        user={user}
        onStartChallenge={handleStartChallenge}
        setTimeMode={setTimeMode}
        onNavigate={handleNavigate}
        tasks={tasks.length > 0 ? tasks : initialTasks}
        onAddTask={addTask}
        onEditTask={editTask}
        onToggleTask={toggleTask}
        onRemoveTask={removeTask}
        initialPointsData={initialPointsData}
        initialChallenge={initialChallenge}
        initialRegStatus={initialRegStatus}
        initialContest={initialContest}
      />
      <AnimatePresence>
        {streak && (
          <StreakCelebration celebration={streak} onDismiss={() => setStreak(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
