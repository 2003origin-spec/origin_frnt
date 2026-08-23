'use client';

import { useRouter } from 'next/navigation';
import Explore from '@/sections/Explore';
import { useAiAccess } from '@/context/AiAccessContext';

const ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  'test-list': '/tests',
  'study-corner': '/study-corner',
  ogcode: '/ogcode',
  'study-rooms': '/study-rooms',
  'tasks-goals': '/tasks',
  'doubt-solver': '/doubt-solver',
  social: '/social',
  connect: '/connect',
  'pomodoro': '/pomodoro',
  'leaderboard': '/leaderboard',
  'dpp': '/dpp',
  'profile': '/profile',
};

export default function ExploreClient({
  socialEnabled = false,
  connectEnabled = false,
  contestEnabled = false,
}: {
  socialEnabled?: boolean;
  connectEnabled?: boolean;
  contestEnabled?: boolean;
}) {
  const router = useRouter();
  const { aiExplainer } = useAiAccess();
  return (
    <Explore
      onNavigate={(view) => router.push(ROUTES[view] ?? `/${view}`)}
      aiExplainer={aiExplainer}
      socialEnabled={socialEnabled}
      connectEnabled={connectEnabled}
      contestEnabled={contestEnabled}
    />
  );
}
