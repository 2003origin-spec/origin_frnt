'use client';

import Explore from '@/sections/Explore';
import { useRouter } from 'next/navigation';

export default function ExplorePage() {
  const router = useRouter();

  const handleNavigate = (view: string) => {
    const routes: Record<string, string> = {
      'dashboard': '/dashboard',
      'test-list': '/tests',
      'study-corner': '/study-corner',
      'ogcode': '/ogcode',
      'tasks-goals': '/tasks'
    };
    router.push(routes[view] || `/${view}`);
  };

  return (
    <Explore
      onNavigate={handleNavigate}
    />
  );
}
