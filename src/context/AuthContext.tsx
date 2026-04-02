'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User, StreakData, Task } from '@/types';
import { apiCall } from '@/lib/api';
import { clearOriginAiBrowserSession } from '@/features/origin-ai/session';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | null;
  streakData: StreakData;
  isLoading: boolean;
  authError: string | null;
  tasks: Task[];
  login: (email: string, password: string, role?: 'student' | 'teacher' | null) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  addTask: (text: string, due: string) => void;
  toggleTask: (id: number) => void;
  removeTask: (id: number) => void;
  isNavigationLocked: boolean;
  setIsNavigationLocked: (locked: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialTodos: Task[] = [
  { id: 1, text: 'Finish Biology Lab Report', completed: true, due: new Date(Date.now() + 86400000).toISOString() },
  { id: 2, text: 'Review Chapter 5 History', completed: true, due: new Date(Date.now() - 172800000).toISOString() },
  { id: 3, text: 'Schedule meeting with Prof', completed: true, due: new Date(Date.now() + 432000000).toISOString() },
  { id: 4, text: 'Practice Spanish Vocab', completed: false, due: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, text: 'Group Project Presentation', completed: true, due: new Date(Date.now() + 86400000).toISOString() },
  { id: 6, text: 'Submit Scholarship App', completed: false, due: new Date(Date.now() - 432000000).toISOString() },
  { id: 7, text: 'Prepare for Quiz on Fri', completed: false, due: new Date(Date.now() + 172800000).toISOString() },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: new Date(),
    weeklyData: [false, false, false, false, false, false, false]
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTodos);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiCall('/users/me/');
      setUser(userData);
      if (userData.streakData) setStreakData(userData.streakData);
      if (userData.role) setUserRole(userData.role);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('origin_access_token') : null;
    if (token) {
      const fetchInitialUser = async () => {
        try {
          const userData = await apiCall('/users/me/');
          setUser(userData);
          if (userData.streakData) setStreakData(userData.streakData);
          if (userData.role) setUserRole(userData.role);
          
          if (pathname === '/auth' || pathname === '/') {
            if (userData.role === 'student' && !userData.isOnboarded) {
                router.push('/onboarding');
            } else {
                router.push('/dashboard');
            }
          }
        } catch (error) {
          console.error('Failed to fetch initial user:', error);
          localStorage.removeItem('origin_access_token');
          localStorage.removeItem('origin_refresh_token');
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialUser();
    } else {
      setIsLoading(false);
      // Redirect to landing if on protected routes
      if (!['/', '/auth', '/role-selection'].includes(pathname)) {
        router.push('/');
      }
    }
  }, [pathname, router]);

  const login = async (email: string, password: string, role?: 'student' | 'teacher' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      clearOriginAiBrowserSession();
      const response = await apiCall('/users/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(role ? { role } : {}) }),
      });

      localStorage.setItem('origin_access_token', response.access);
      localStorage.setItem('origin_refresh_token', response.refresh);

      setUser(response.user);
      if (response.user.streakData) setStreakData(response.user.streakData);
      if (response.user.role) setUserRole(response.user.role);
      
      if (response.user.role === 'student' && !response.user.isOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      toast.success('Welcome back to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setUserRole(null);
    clearOriginAiBrowserSession();
    localStorage.removeItem('origin_access_token');
    localStorage.removeItem('origin_refresh_token');
    router.push('/');
    toast.info('Logged out successfully');
  };

  const addTask = (text: string, due: string) => {
    const newTask: Task = {
      id: Date.now(),
      text,
      due,
      completed: false,
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      streakData,
      isLoading,
      authError,
      tasks,
      login,
      logout,
      refreshUser,
      addTask,
      toggleTask,
      removeTask,
      isNavigationLocked,
      setIsNavigationLocked
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
