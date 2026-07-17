'use client';

import Pomodoro from '@/sections/Pomodoro';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';
import { useAppBack } from '@/hooks/useAppBack';

export default function PomodoroClient() {
  const { user, setIsNavigationLocked, tasks } = useAuth();
  const router = useRouter();
  const goBack = useAppBack();
  const { setTimeMode } = useTimeTracker(!!user);

  if (!user) return null;

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      dashboard: '/dashboard',
      'test-list': '/tests',
      'study-corner': '/study-corner',
      ogcode: '/ogcode',
      'tasks-goals': '/tasks',
    };
    router.push(routes[view] || `/${view}`);
  };

  return (
    <Pomodoro
      onBack={goBack}
      user={user}
      setTimeMode={setTimeMode}
      onNavigate={handleNavigate}
      onLock={setIsNavigationLocked}
      tasks={tasks}
    />
  );
}
