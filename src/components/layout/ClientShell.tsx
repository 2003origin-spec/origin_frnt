'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from './Navbar';
import FloatingChat from './FloatingChat';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isNavigationLocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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

  const noNavbarPaths = ['/', '/auth', '/onboarding', '/role-selection', '/explore'];
  const isSpecialPath = pathname.startsWith('/tests/') || pathname.startsWith('/ogcode/');
  
  const showNavbar = user && user.role === 'student' && !isNavigationLocked && !noNavbarPaths.includes(pathname) && !isSpecialPath;

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-200 font-sans antialiased overflow-x-hidden relative flex flex-col transition-colors duration-300">
      {mounted && showNavbar && (
        <Navbar
          user={user}
          currentView={pathname.replace('/', '') as any}
          onNavigate={handleNavigate}
          onLogout={logout}
          theme={theme as any}
          setTheme={setTheme as any}
        />
      )}
      <main className={`flex-1 flex flex-col ${showNavbar ? 'pt-[92px]' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {user && <FloatingChat />}
    </div>
  );
}
