'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ViewState } from '@/types';
import Navbar from './Navbar';
import { useTheme } from 'next-themes';
import { TutorialProvider } from '@/features/tutorial/TutorialProvider';
import { cn } from '@/lib/utils';
import { useResizable } from '@/hooks/use-resizable';
import AiSidebar from './AiSidebar';
import { LayoutProvider, useLayout } from '@/context/LayoutContext';
import { TimeTrackerProvider } from '@/context/TimeTrackerContext';

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

function ClientShellInner({ children }: { children: React.ReactNode }) {
  const { user, logout, isNavigationLocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { setSidebarWidth, setIsAiOpen: setContextAiOpen } = useLayout();
  const [mounted, setMounted] = React.useState(false);
  const [deferredUiReady, setDeferredUiReady] = React.useState(false);

  // Side AI State
  const [isAiOpen, setIsAiOpenInternal] = React.useState(false);

  // Sync state with context
  React.useEffect(() => {
    setContextAiOpen(isAiOpen);
  }, [isAiOpen, setContextAiOpen]);

  const [aiSide, setAiSide] = React.useState<'left' | 'right'>('right');
  const [autoAskSelectionNonce, setAutoAskSelectionNonce] = React.useState(0);

  const { width: aiWidth, isResizing, startResizing } = useResizable({
    initialWidth: typeof window !== 'undefined' ? window.innerWidth * 0.2 : 400,
    minWidth: 320,
    maxWidth: 800,
    side: aiSide,
  });

  // Sync with layout context
  React.useEffect(() => {
    setSidebarWidth(isAiOpen ? aiWidth : 0);
  }, [aiWidth, isAiOpen, setSidebarWidth]);

  const toggleAi = React.useCallback((options?: { autoAskSelection?: boolean }) => {
    if (options?.autoAskSelection) {
      setAutoAskSelectionNonce((current) => current + 1);
    }
    setIsAiOpenInternal(true);
  }, []);

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
  const isTestsPath = pathname === '/tests' || pathname.startsWith('/tests/');
  const isSpecialPath = pathname.startsWith('/tests/') || pathname.startsWith('/ogcode/');
  const shouldShowFloatingOriginAi =
    deferredUiReady &&
    !!user &&
    !noNavbarPaths.includes(pathname) &&
    !isTestsPath;
  
  const currentTheme = (mounted ? resolvedTheme : 'dark') || 'dark';
  const showNavbar = mounted && !!user && user.role === 'student' && !isNavigationLocked && !noNavbarPaths.includes(pathname) && !isSpecialPath;

  return (
    <TutorialProvider>
      <div id="tutorial-welcome" className={cn(
        "h-screen bg-background text-foreground font-sans antialiased overflow-hidden relative flex transition-colors duration-700",
        aiSide === 'right' ? 'flex-row' : 'flex-row-reverse'
      )}>
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative h-screen">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-20">
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
          <main className={cn(
            "flex-1 flex flex-col relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar",
            "transition-all duration-300 min-w-[320px]",
            mounted && showNavbar ? 'pt-[92px]' : ''
          )}>
            <div className="flex-1 flex flex-col relative w-full max-w-full">
              {children}
            </div>
          </main>
        </div>

        {/* Resizable AI Sidebar */}
        {shouldShowFloatingOriginAi && (
           <AiSidebar 
            isOpen={isAiOpen}
            onClose={() => setIsAiOpenInternal(false)}
            width={aiWidth}
            isResizing={isResizing}
            onResizeStart={startResizing}
            side={aiSide}
            onSideToggle={() => setAiSide(prev => prev === 'left' ? 'right' : 'left')}
            autoAskSelectionNonce={autoAskSelectionNonce}
          />
        )}

        {shouldShowFloatingOriginAi && (
          <FloatingChat 
            onOpen={toggleAi} 
            autoAskSelectionNonce={autoAskSelectionNonce} 
            hideMainButton={isAiOpen} 
          />
        )}

        {deferredUiReady ? <TutorialOverlay /> : null}
      </div>
    </TutorialProvider>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <TimeTrackerProvider>
        <ClientShellInner>{children}</ClientShellInner>
      </TimeTrackerProvider>
    </LayoutProvider>
  );
}
