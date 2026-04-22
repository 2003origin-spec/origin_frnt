'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User, StreakData, Task } from '@/types';
import { clearOriginAiBrowserSession } from '@/features/origin-ai/session';
import { apiCall, AUTH_EXPIRED_EVENT } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | null;
  streakData: StreakData;
  isLoading: boolean;
  authError: string | null;
  tasks: Task[];
  tasksLoading: boolean;
  login: (email: string, password: string, role?: 'student' | 'teacher' | null) => Promise<void>;
  register: (name: string, email: string, password: string, role?: 'student' | 'teacher' | null) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  addTask: (text: string, due: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  isNavigationLocked: boolean;
  setIsNavigationLocked: (locked: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  weeklyData: [false, false, false, false, false, false, false],
};

const PUBLIC_PATHS = ['/', '/auth', '/role-selection'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);
  const [streakData, setStreakData] = useState<StreakData>(EMPTY_STREAK);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const tasksFetched = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const applyUserData = useCallback((userData: User) => {
    setUser(userData);
    if (userData.streakData) setStreakData(userData.streakData);
    if (userData.role === 'student' || userData.role === 'teacher') setUserRole(userData.role);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (tasksFetched.current) return;
    tasksFetched.current = true;
    setTasksLoading(true);
    try {
      const data = await apiCall('/users/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal — tasks stay empty, user can still use the app
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiCall('/users/me/') as User;
      applyUserData(userData);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to refresh user:', error);
      }
    }
  }, [applyUserData]);

  // Runs once on mount — fetches user from stored token and listens for session expiry
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setUserRole(null);
      setTasks([]);
      tasksFetched.current = false;
      clearOriginAiBrowserSession();
      router.push('/auth');
      toast.error('Your session expired. Please log in again.');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    const token = localStorage.getItem('origin_access_token');
    if (!token) {
      setIsLoading(false);
      return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    }

    const fetchInitialUser = async () => {
      try {
        const userData = await apiCall('/users/me/') as User;
        applyUserData(userData);
        await fetchTasks();
        const currentPath = window.location.pathname;
        if (currentPath === '/auth' || currentPath === '/') {
          if (userData.role === 'student' && !userData.isOnboarded) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        }
      } catch {
        localStorage.removeItem('origin_access_token');
        localStorage.removeItem('origin_refresh_token');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialUser();
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs on every route change — redirects unauthenticated users off protected pages
  useEffect(() => {
    if (isLoading) return;
    if (!user && !PUBLIC_PATHS.includes(pathname) && !pathname.startsWith('/admin')) {
      router.push('/');
    }
  }, [pathname, user, isLoading, router]);

  const login = async (email: string, password: string, role?: 'student' | 'teacher' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await apiCall('/users/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(role ? { role } : {}) }),
      });

      clearOriginAiBrowserSession();
      localStorage.setItem('origin_access_token', response.access);
      localStorage.setItem('origin_refresh_token', response.refresh);

      setUser(response.user);
      if (response.user.streakData) setStreakData(response.user.streakData);
      if (response.user.role === 'student' || response.user.role === 'teacher') setUserRole(response.user.role);

      tasksFetched.current = false;
      await fetchTasks();

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

  const register = async (name: string, email: string, password: string, role?: 'student' | 'teacher' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await apiCall('/users/register/', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, ...(role ? { role } : {}) }),
      });

      clearOriginAiBrowserSession();
      localStorage.setItem('origin_access_token', response.access);
      localStorage.setItem('origin_refresh_token', response.refresh);

      setUser(response.user);
      if (response.user.streakData) setStreakData(response.user.streakData);
      if (response.user.role === 'student' || response.user.role === 'teacher') setUserRole(response.user.role);

      tasksFetched.current = false;
      await fetchTasks();

      if (response.user.role === 'student' && !response.user.isOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      toast.success('Registration successful! Welcome to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (credential: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await apiCall('/users/google-login/', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });

      clearOriginAiBrowserSession();
      localStorage.setItem('origin_access_token', response.access);
      localStorage.setItem('origin_refresh_token', response.refresh);

      setUser(response.user);
      if (response.user.streakData) setStreakData(response.user.streakData);
      if (response.user.role === 'student' || response.user.role === 'teacher') setUserRole(response.user.role);

      tasksFetched.current = false;
      await fetchTasks();

      if (response.user.role === 'student' && !response.user.isOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      toast.success('Google login successful! Welcome to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setUserRole(null);
    setTasks([]);
    tasksFetched.current = false;
    clearOriginAiBrowserSession();
    localStorage.removeItem('origin_access_token');
    localStorage.removeItem('origin_refresh_token');
    // Clear the HttpOnly cookies that Server Components read (fire-and-forget)
    fetch('/api/users/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    toast.info('Logged out successfully');
  };

  const addTask = async (text: string, due: string) => {
    // Optimistic: add a temporary task immediately
    const tempId = `temp_${Date.now()}`;
    const optimistic: Task = { id: tempId, text, due, completed: false };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const created = await apiCall('/users/tasks', {
        method: 'POST',
        body: JSON.stringify({ text, due }),
      });
      // Replace temp task with server-assigned ID
      setTasks(prev => prev.map(t => t.id === tempId ? created : t));
    } catch {
      // Revert on failure
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast.error('Failed to save task. Please try again.');
    }
  };

  const toggleTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    if (!original) return;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try {
      await apiCall(`/users/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !original.completed }),
      });
    } catch {
      // Revert
      setTasks(prev => prev.map(t => t.id === id ? original : t));
      toast.error('Failed to update task.');
    }
  };

  const removeTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    // Optimistic remove
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await apiCall(`/users/tasks/${id}`, { method: 'DELETE' });
    } catch {
      // Revert
      if (original) setTasks(prev => [original, ...prev]);
      toast.error('Failed to delete task.');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      streakData,
      isLoading,
      authError,
      tasks,
      tasksLoading,
      login,
      register,
      googleLogin,
      logout,
      refreshUser,
      addTask,
      toggleTask,
      removeTask,
      isNavigationLocked,
      setIsNavigationLocked,
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
