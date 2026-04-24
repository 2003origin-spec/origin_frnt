'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ViewState } from '@/types';
import Navbar from './Navbar';
import { useTheme } from 'next-themes';
import { TutorialProvider } from '@/features/tutorial/TutorialProvider';

const FloatingChat = dynamic(() => import('./FloatingChat'), { ssr: false });
const TutorialOverlay = dynamic(() =>
  import('@/features/tutorial/TutorialOverlay').then((module) => module.TutorialOverlay),
  { ssr: false },
);

const ROUTES: Record<string, string> = {
  'landing': '/',
  'dashboard': '/dashboard',
  'auth': '/auth',
  'test-list': '/tests',
  'test-interface': '/tests',
  'test-result': '/tests/result',
  'ogcode': '/ogcode',
  'ogcode-workspace': '/ogcode',
  'doubt-solver': '/doubt-solver',
  'dpp': '/dpp',
  'tasks-goals': '/tasks',
  'explore': '/explore',
  'profile': '/profile',
  'premium': '/premium',
  'study-corner': '/study-corner',
  'pomodoro': '/pomodoro',
  'leaderboard': '/leaderboard',
  'milestones': '/milestones',
  'prestige-milestones': '/milestones',
};

function resolveRoute(view: string) {
  return ROUTES[view] || `/${view}`;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isNavigationLocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [deferredUiReady, setDeferredUiReady] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDeferredUiReady(true);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [mounted]);

  const prefetchRoute = React.useCallback((view: string) => {
    router.prefetch(resolveRoute(view));
  }, [router]);

  React.useEffect(() => {
    if (!mounted || !user || isNavigationLocked) {
      return;
    }

    const routesToPrefetch = user.role === 'teacher'
      ? ['/dashboard', '/profile']
      : ['/dashboard', '/ogcode', '/tests', '/dpp', '/tasks', '/study-corner', '/pomodoro', '/leaderboard', '/milestones', '/profile'];

    const timeoutId = window.setTimeout(() => {
      routesToPrefetch.forEach((route) => router.prefetch(route));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isNavigationLocked, mounted, router, user]);

  const handleNavigate = (view: string) => {
    router.push(resolveRoute(view));
  };

  const noNavbarPaths = ['/', '/auth', '/onboarding', '/role-selection'];
  const isSpecialPath = pathname.startsWith('/tests/') || pathname.startsWith('/ogcode/');
  
  // Use resolvedTheme if available to handle 'system' correctly
  const currentTheme = (mounted ? resolvedTheme : 'dark') || 'dark';
  
  // Show Navbar on more paths if needed
  const showNavbar = mounted && !!user && user.role === 'student' && !isNavigationLocked && !noNavbarPaths.includes(pathname) && !isSpecialPath;

  return (
    <TutorialProvider>
      <div id="tutorial-welcome" className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden relative flex flex-col transition-colors duration-700">
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-20">
        <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-100 dark:bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-slate-100 dark:bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {mounted && showNavbar && (
        <Navbar
          user={user}
          currentView={pathname.replace('/', '') as ViewState}
          onNavigate={handleNavigate}
          onPrefetch={prefetchRoute}
          onLogout={logout}
          theme={currentTheme as "dark" | "light" | "system"}
          setTheme={setTheme}
        />
      )}
      <main className={`flex-1 flex flex-col relative z-10 ${mounted && showNavbar ? 'pt-[92px]' : ''}`}>
        <div className="flex-1 flex flex-col relative">
          {children}
        </div>
      </main>
      {deferredUiReady && user && !noNavbarPaths.includes(pathname) && pathname !== '/doubt-solver'
        ? <FloatingChat />
        : null}
      {deferredUiReady ? <TutorialOverlay /> : null}
    </div>
    </TutorialProvider>
  );
}
