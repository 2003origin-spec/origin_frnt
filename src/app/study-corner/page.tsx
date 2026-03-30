'use client';

import StudyCorner from '@/sections/StudyCorner';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function StudyCornerPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

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
    <StudyCorner
      user={user}
      onNavigate={handleNavigate}
    />
  );
}
