'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User, StreakData, Task } from '@/types';
import { clearOriginAiBrowserSession } from '@/features/origin-ai/session';
import { AUTH_EXPIRED_EVENT, TOKEN_REFRESHED_EVENT } from '@/lib/api';
import {
  addTaskAction,
  listTasksAction,
  removeTaskAction,
  toggleTaskAction,
} from '@/server/actions/task-actions';
import {
  googleLoginAction,
  loginAction,
  logoutAction,
  refreshUserAction,
  registerAction,
} from '@/server/actions/auth-actions';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | 'admin' | null;
  streakData: StreakData;
  isLoading: boolean;
  authError: string | null;
  tasks: Task[];
  tasksLoading: boolean;
  login: (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  register: (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  addTask: (text: string, due: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  primeTasks: (seededTasks: Task[]) => void;
  isNavigationLocked: boolean;
  setIsNavigationLocked: (locked: boolean) => void;
  accessToken: string | null;
  refreshToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  weeklyData: [false, false, false, false, false, false, false],
};

const PUBLIC_PATHS = ['/', '/auth', '/role-selection'];

function normalizeRole(role: User['role'] | undefined): 'student' | 'teacher' | 'admin' | null {
  return role === 'student' || role === 'teacher' || role === 'admin' ? role : null;
}

interface AuthProviderProps {
  children: React.ReactNode;
  /**
   * Server-resolved user, seeded from the root layout via `getServerFrontendUser`.
   * When present, the provider starts fully hydrated with no loading state and
   * no blocking `/users/me` round-trip.
   */
  initialUser: User | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  const [user, setUser] = useState<User | null>(initialUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(
    normalizeRole(initialUser?.role),
  );
  const [streakData, setStreakData] = useState<StreakData>(initialUser?.streakData ?? EMPTY_STREAK);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(typeof window !== 'undefined' && !initialUser);
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
    setUserRole(normalizeRole(userData.role));
  }, []);

  const fetchTasks = useCallback(async () => {
    if (tasksFetched.current) return;
    tasksFetched.current = true;
    setTasksLoading(true);
    try {
      const data = await listTasksAction();
      setTasks((data ?? []) as unknown as Task[]);
    } catch {
      // Non-fatal — tasks stay empty, user can still use the app
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const primeTasks = useCallback((seededTasks: Task[]) => {
    tasksFetched.current = true;
    setTasksLoading(false);
    setTasks((current) => (current.length > 0 ? current : seededTasks));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await refreshUserAction();
      if (userData) applyUserData(userData);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to refresh user:', error);
      }
    }
  }, [applyUserData]);

  // 1. Session Hydration: If the server didn't find a user (expired cookie) but
  // localStorage has tokens, attempt a silent recovery.
  useEffect(() => {
    const hydrate = async () => {
      const storedAccess = localStorage.getItem('origin_access_token');
      const storedRefresh = localStorage.getItem('origin_refresh_token');

      if (storedAccess) setAccessToken(storedAccess);
      if (storedRefresh) setRefreshToken(storedRefresh);

      // If we have an initial user from the server, we're already hydrated.
      if (initialUser) {
        setIsHydrating(false);
        return;
      }

      // If no tokens in localStorage, we're done.
      if (!storedAccess) {
        setIsHydrating(false);
        return;
      }

      try {
        // Try to fetch the user profile using the stored token.
        // refreshUserAction() uses getServerUser() which checks cookies, 
        // so we actually need to hit the /api/users/me endpoint directly 
        // to use the Bearer token from localStorage.
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${storedAccess}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            applyUserData(data.user);
          }
        } else if (response.status === 401 && storedRefresh) {
          // Access token expired, try to refresh
          const refreshRes = await fetch('/api/users/token/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: storedRefresh })
          });
          
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.access) {
              localStorage.setItem('origin_access_token', refreshData.access);
              setAccessToken(refreshData.access);
              // Retry fetching user
              const retryRes = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${refreshData.access}` }
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (retryData.user) applyUserData(retryData.user);
              }
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] Hydration failed:', err);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate();
  }, [initialUser, applyUserData]);

  // Auth-expired listener only.
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setUserRole(null);
      setAccessToken(null);
      setRefreshToken(null);
      setTasks([]);
      tasksFetched.current = false;
      clearOriginAiBrowserSession();
      router.push('/auth');
      toast.error('Your session expired. Please log in again.');
    };
    const handleTokenRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.access) setAccessToken(detail.access);
      if (detail.refresh) setRefreshToken(detail.refresh);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    window.addEventListener(TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
      window.removeEventListener(TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs on every route change and keeps protected and guest-only pages aligned
  // with the current auth state.
  useEffect(() => {
    if (isLoading || isHydrating) return;

    // Normalize path for robust matching (remove trailing slash except for root)
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const isPublicPath = PUBLIC_PATHS.some(p => normalizedPath === p);

    // 1. Unauthenticated users: redirect away from protected pages
    if (!user && !isPublicPath && !normalizedPath.startsWith('/admin')) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AuthGuard] Unauthenticated user on protected path ${normalizedPath}, redirecting to /`);
      }
      router.push('/');
      return;
    }

    // 2. Authenticated users: redirect away from guest pages
    if (user && isPublicPath) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AuthGuard] Authenticated user on guest path ${normalizedPath}, redirecting to functional area`);
      }
      if (user.role === 'student' && !user.isOnboarded) {
        router.push('/onboarding');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    }
  }, [pathname, user, isLoading, router]);

  const login = async (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await loginAction({ email, password, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();
      // Tokens already live in HttpOnly cookies; mirror to localStorage so
      // legacy `apiCall` sites (and the mobile bridge) keep working until
      // every call site is migrated off the /api/... bridge.
      if (result.access) {
        localStorage.setItem('origin_access_token', result.access);
        setAccessToken(result.access);
      }
      if (result.refresh) {
        localStorage.setItem('origin_refresh_token', result.refresh);
        setRefreshToken(result.refresh);
      }

      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
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

  const register = async (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await registerAction({ name, email, password, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();
      if (result.access) {
        localStorage.setItem('origin_access_token', result.access);
        setAccessToken(result.access);
      }
      if (result.refresh) {
        localStorage.setItem('origin_refresh_token', result.refresh);
        setRefreshToken(result.refresh);
      }

      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
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
      const result = await googleLoginAction({ credential });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();
      if (result.access) {
        localStorage.setItem('origin_access_token', result.access);
        setAccessToken(result.access);
      }
      if (result.refresh) {
        localStorage.setItem('origin_refresh_token', result.refresh);
        setRefreshToken(result.refresh);
      }

      setUser(result.user);
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
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
    // Server Action clears the HttpOnly cookies + revalidates the RSC tree.
    // Fire-and-forget so the UI never waits on the round-trip.
    void logoutAction().catch(() => {});
    setAccessToken(null);
    setRefreshToken(null);
    router.push('/');
    toast.info('Logged out successfully');
  };

  const addTask = async (text: string, due: string) => {
    const tempId = `temp_${Date.now()}`;
    const optimistic: Task = { id: tempId, text, due, completed: false };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const created = await addTaskAction({ text, due });
      setTasks(prev => prev.map(t => t.id === tempId ? (created as unknown as Task) : t));
    } catch {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast.error('Failed to save task. Please try again.');
    }
  };

  const toggleTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    if (!original) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try {
      await toggleTaskAction(id, !original.completed);
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? original : t));
      toast.error('Failed to update task.');
    }
  };

  const removeTask = async (id: string) => {
    const original = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await removeTaskAction(id);
    } catch {
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
      primeTasks,
      isNavigationLocked,
      setIsNavigationLocked,
      accessToken,
      refreshToken,
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
