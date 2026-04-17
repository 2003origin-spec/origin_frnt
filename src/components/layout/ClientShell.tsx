'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ViewState } from '@/types';
import Navbar from './Navbar';
import FloatingChat from './FloatingChat';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isNavigationLocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavigate = (view: string) => {
    // Basic mapping for backward compatibility with Navbar views
    const routes: Record<string, string> = {
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
      'milestones': '/milestones'
    };
    
    const route = routes[view] || `/${view}`;
    router.push(route);
  };

  const noNavbarPaths = ['/', '/auth', '/onboarding', '/role-selection'];
  const isSpecialPath = pathname.startsWith('/tests/') || pathname.startsWith('/ogcode/');
  
  // Use resolvedTheme if available to handle 'system' correctly
  const currentTheme = (mounted ? resolvedTheme : 'dark') || 'dark';
  
  // Show Navbar on more paths if needed
  const showNavbar = user && user.role === 'student' && !isNavigationLocked && !noNavbarPaths.includes(pathname) && !isSpecialPath;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden relative flex flex-col transition-colors duration-700">
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
          onLogout={logout}
          theme={currentTheme as "dark" | "light" | "system"}
          setTheme={setTheme}
        />
      )}
      <main className={`flex-1 flex flex-col relative z-10 ${mounted && showNavbar ? 'pt-[92px]' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {user && pathname !== '/doubt-solver' && <FloatingChat />}
    </div>
  );
}

