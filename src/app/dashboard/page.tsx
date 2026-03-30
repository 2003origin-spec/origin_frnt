'use client';

import Dashboard from '@/sections/Dashboard';
import TeacherDashboard from '@/sections/TeacherDashboard';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';

export default function DashboardPage() {
  const { 
    user, 
    tasks, 
    addTask, 
    toggleTask, 
    removeTask 
  } = useAuth();
  const router = useRouter();
  const { setTimeMode } = useTimeTracker(!!user);

  if (!user) return null;

  if (user.role === 'teacher') {
    return <TeacherDashboard user={user} />;
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
      'leaderboard': '/leaderboard'
    };
    router.push(routes[view] || `/${view}`);
  };

  return (
    <Dashboard
      user={user}
      onStartChallenge={handleStartChallenge}
      setTimeMode={setTimeMode}
      onNavigate={handleNavigate}
      tasks={tasks}
      onAddTask={addTask}
      onToggleTask={toggleTask}
      onRemoveTask={removeTask}
    />
  );
}
