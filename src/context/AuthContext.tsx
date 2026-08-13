'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { User, StreakData, Task } from '@/types';
import { clearOriginAiBrowserSession } from '@/features/origin-ai/session';
import { setSoundPreferences, playCategory } from '@/lib/sound-manager';
import { AUTH_EXPIRED_EVENT, attemptTokenRefresh, consumeAuthExpiredReason } from '@/lib/api';
import { flushNativeCookies, notifyNativeLogout } from '@/native/bridge';
import { purgeUserCachesForLogout } from '@/sw/client';
import {
  addTaskAction,
  editTaskAction,
  listTasksAction,
  removeTaskAction,
  toggleTaskAction,
} from '@/server/actions/task-actions';
import {
  googleLoginAction,
  googleSignupAction,
  loginAction,
  loginWithOtpAction,
  logoutAction,
  refreshTokenAction,
  refreshUserAction,
  registerAction,
} from '@/server/actions/auth-actions';
import { sendOtpAction, verifyOtpAction } from '@/server/actions/otp-actions';
import {
  dismissStudyModePromptAction,
  setStudyModeAction,
} from '@/server/actions/study-mode-actions';
import { DEFAULT_STUDY_MODE, normalizeStudyMode, type StudyMode } from '@/lib/study-mode';
import { track } from '@/lib/analytics';

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'teacher' | 'admin' | null;
  streakData: StreakData;
  isLoading: boolean;
  authError: string | null;
  tasks: Task[];
  tasksLoading: boolean;
  login: (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  loginWithOtp: (email: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  register: (name: string, email: string, password: string, mobile: string, state: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  googleLogin: (credential: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<void>;
  /** Set when Google login found no account — AuthPage shows the details step. */
  pendingGoogleSignup: { email: string; name: string } | null;
  /** Complete the Google signup with the mandatory details. */
  googleSignup: (mobile: string, state: string) => Promise<void>;
  cancelGoogleSignup: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  addTask: (text: string, due: string) => Promise<void>;
  editTask: (id: string, text: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  primeTasks: (seededTasks: Task[]) => void;
  isNavigationLocked: boolean;
  setIsNavigationLocked: (locked: boolean) => void;
  sendOtp: (email: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<{ ok: boolean; message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ ok: boolean; message: string }>;
  /**
   * The student's active Study Mode (JEE / NEET / PCMB). Derived from `user`, so
   * it is correct on the very first server-rendered paint and after every login,
   * refresh and logout with no extra state to keep in sync. Non-students and
   * never-chosen students report DEFAULT_STUDY_MODE.
   */
  studyMode: StudyMode;
  /** False when the student has never chosen — `studyMode` is then the default. */
  studyModeExplicit: boolean;
  /**
   * Whether to render the mode toggle at all. Server-derived: false for free
   * students and for anyone owning fewer than a complete JEE/NEET/PCMB set.
   */
  studyModeAvailable: boolean;
  /** The modes this student may actually select. Others render disabled. */
  availableStudyModes: StudyMode[];
  /** True once the first-run mode picker has been answered or dismissed. */
  studyModePrompted: boolean;
  /** True while a switch is in flight (the toggle shows the optimistic value). */
  studyModePending: boolean;
  /** Persists a new mode. Optimistic; reverts and toasts on failure. */
  setStudyMode: (mode: StudyMode) => Promise<boolean>;
  /** Dismisses the first-run picker without choosing (mode stays the default). */
  dismissStudyModePrompt: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  weeklyData: [false, false, false, false, false, false, false],
};

const GUEST_ONLY_PATHS = ['/', '/auth', '/role-selection'];
const SHARED_PUBLIC_PATHS = ['/terms-and-conditions', '/privacy-policy', '/childrens-policy', '/refund-policy', '/return-policy', '/shipping-policy', '/faq', '/founders'];

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

// Paced against the 1-hour ACCESS_TOKEN_TTL_SECONDS (server/auth-jwt.ts): renew
// at 50 min, leaving a 10-minute margin for clock skew and a slow round-trip.
// Each refresh is a session-row write, so the opportunistic focus/pointerdown
// path is spaced to match rather than firing on every return to the tab. A tab
// suspended past the hour is still covered reactively — middleware 302s to
// /auth/refresh, and AUTH_EXPIRED_EVENT recovers in-flight fetches.
const ACCESS_REFRESH_INTERVAL_MS = 50 * 60 * 1000;
const ACCESS_REFRESH_MIN_SPACING_MS = 45 * 60 * 1000;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  const [user, setUser] = useState<User | null>(initialUser);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(
    normalizeRole(initialUser?.role),
  );
  const [streakData, setStreakData] = useState<StreakData>(initialUser?.streakData ?? EMPTY_STREAK);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(typeof window !== 'undefined' && !initialUser);
  const [authRecoveryBlocked, setAuthRecoveryBlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const tasksFetched = useRef(false);
  const lastSessionRefreshAt = useRef(Date.now());
  const authExpiredRecovery = useRef<Promise<void> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Keep the sound-effects manager in sync with the active user's preferences.
  useEffect(() => {
    setSoundPreferences(user?.soundPreferences ?? null);
  }, [user?.soundPreferences]);

  // ── Study Mode ────────────────────────────────────────────────────────────
  // Derived from `user` rather than mirrored into its own state: every auth path
  // already funnels through setUser(), so there is nothing extra to keep in sync
  // and no chance of a stale mode surviving a logout on a shared device. The
  // only local state is the optimistic value held during the server round-trip.
  const [pendingStudyMode, setPendingStudyMode] = useState<StudyMode | null>(null);
  const storedStudyMode = normalizeStudyMode(user?.studyMode);
  const studyMode: StudyMode = pendingStudyMode ?? storedStudyMode ?? DEFAULT_STUDY_MODE;
  const studyModeExplicit = pendingStudyMode != null || storedStudyMode != null;
  const studyModePrompted = Boolean(user?.studyModePrompted);
  const studyModeAvailable = Boolean(user?.studyModeAvailable);
  const availableStudyModes = useMemo(
    () => user?.availableStudyModes ?? [],
    [user?.availableStudyModes],
  );

  // Drop the optimistic value once the server value catches up (or the user changes).
  useEffect(() => {
    if (pendingStudyMode != null && storedStudyMode === pendingStudyMode) {
      setPendingStudyMode(null);
    }
  }, [pendingStudyMode, storedStudyMode]);
  useEffect(() => {
    setPendingStudyMode(null);
  }, [user?.id]);

  const setStudyMode = useCallback(
    async (mode: StudyMode): Promise<boolean> => {
      setPendingStudyMode(mode);
      try {
        const result = await setStudyModeAction(mode);
        if (!result.ok) {
          setPendingStudyMode(null);
          toast.error(result.error);
          return false;
        }
        setUser((current) =>
          current ? { ...current, studyMode: result.mode, studyModePrompted: true } : current,
        );
        // Re-render the RSC tree so server-scoped lists reflect the new mode
        // without a manual reload.
        router.refresh();
        track('study_mode_switch', { mode: result.mode });
        return true;
      } catch (error) {
        setPendingStudyMode(null);
        toast.error(error instanceof Error ? error.message : 'Could not change your study mode.');
        return false;
      }
    },
    [router],
  );

  const dismissStudyModePrompt = useCallback(async (): Promise<void> => {
    // Optimistic: the picker must disappear on tap even if the write is slow.
    setUser((current) => (current ? { ...current, studyModePrompted: true } : current));
    try {
      await dismissStudyModePromptAction();
    } catch {
      // Best-effort — the picker reappears on the next load if this failed.
    }
  }, []);

  const applyUserData = useCallback((userData: User) => {
    lastSessionRefreshAt.current = Date.now();
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

  const refreshActiveSession = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastSessionRefreshAt.current < ACCESS_REFRESH_MIN_SPACING_MS) return;

    const result = await refreshTokenAction();
    if (result.ok) {
      lastSessionRefreshAt.current = Date.now();
      setAuthRecoveryBlocked(false);
      return;
    }

    const stillAuthenticated = await refreshUserAction();
    if (stillAuthenticated) {
      applyUserData(stillAuthenticated);
      setAuthRecoveryBlocked(false);
      return;
    }

    if (result.status === 429 || result.status >= 500) {
      setAuthRecoveryBlocked(true);
      return;
    }

    setAuthRecoveryBlocked(true);
  }, [applyUserData, user]);

  // 1. Session Hydration: derive auth from the HttpOnly cookie, never from
  // browser-readable token storage.
  useEffect(() => {
    const hydrate = async () => {
      // If we have an initial user from the server, we're already hydrated.
      if (initialUser) {
        setAuthRecoveryBlocked(false);
        setIsHydrating(false);
        return;
      }

      const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
      if (normalizedPath === '/auth') {
        setAuthRecoveryBlocked(false);
        setIsHydrating(false);
        return;
      }

      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.user ?? data;
          if (userData?.id) {
            applyUserData(userData);
            setAuthRecoveryBlocked(false);
          }
        } else if (response.status === 401) {
          const refreshResult = await attemptTokenRefresh();
          
          if (refreshResult === 'ok') {
            const retryRes = await fetch('/api/users/me', {
              credentials: 'include',
              cache: 'no-store',
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              const retryUser = retryData.user ?? retryData;
              if (retryUser?.id) {
                applyUserData(retryUser);
                setAuthRecoveryBlocked(false);
              }
            } else if (retryRes.status === 429 || retryRes.status >= 500) {
              setAuthRecoveryBlocked(true);
            }
          } else if (refreshResult === 'transient') {
            setAuthRecoveryBlocked(true);
          }
        } else if (response.status === 429 || response.status >= 500) {
          setAuthRecoveryBlocked(true);
        }
      } catch (err) {
        console.error('[AuthContext] Hydration failed:', err);
        setAuthRecoveryBlocked(true);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate();
  }, [initialUser, applyUserData, pathname]);

  // Keep the short-lived access cookie warm while an authenticated user is
  // still active, so idle clicks do not have to go through a hard page refresh.
  useEffect(() => {
    if (!user) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshActiveSession(false);
      }
    };
    const interval = window.setInterval(() => {
      void refreshActiveSession(true);
    }, ACCESS_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    document.addEventListener('pointerdown', refreshIfVisible, { capture: true, passive: true });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      document.removeEventListener('pointerdown', refreshIfVisible, { capture: true });
    };
  }, [user, refreshActiveSession]);

  // Auth-expired listener only.
  useEffect(() => {
    const handleAuthExpired = () => {
      if (authExpiredRecovery.current) return;

      authExpiredRecovery.current = (async () => {
        setAuthRecoveryBlocked(true);

        try {
          const refreshResult = await refreshTokenAction();
          const refreshedUser = await refreshUserAction();

          if (refreshResult.ok && refreshedUser) {
            applyUserData(refreshedUser);
            setAuthRecoveryBlocked(false);
            return;
          }

          if (refreshedUser) {
            applyUserData(refreshedUser);
            setAuthRecoveryBlocked(false);
            return;
          }

          if (refreshResult.status === 429 || refreshResult.status >= 500) {
            return;
          }
        } catch {
          return;
        }

        setUser(null);
        setUserRole(null);
        setTasks([]);
        tasksFetched.current = false;
        clearOriginAiBrowserSession();
        // The server has cleared the auth cookies on this hard refresh failure,
        // so land on the login page (not home) to avoid the edge /auth→home loop.
        // Carry a precise revoke/delete notice across the full reload; /auth shows
        // it via the mount effect below.
        const reason = consumeAuthExpiredReason();
        try {
          sessionStorage.setItem(
            'origin:auth:notice',
            reason?.detail || 'Your session has ended. Please sign in again.',
          );
        } catch {
          /* sessionStorage unavailable */
        }
        window.location.href = '/auth';
      })().finally(() => {
        authExpiredRecovery.current = null;
      });
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [applyUserData]);

  // Show a one-time auth notice (e.g. account revoked/deleted) carried across the
  // full reload that the auth-expired handler triggers.
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('origin:auth:notice');
      if (notice) {
        sessionStorage.removeItem('origin:auth:notice');
        toast.error(notice, { duration: 8000 });
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);

  // Runs on every route change and keeps protected and guest-only pages aligned
  // with the current auth state.
  useEffect(() => {
    if (isLoading || isHydrating || authRecoveryBlocked) return;

    // Normalize path for robust matching (remove trailing slash except for root)
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const isGuestOnlyPath = GUEST_ONLY_PATHS.some(p => normalizedPath === p);
    const isSharedPublicPath = SHARED_PUBLIC_PATHS.some(p => normalizedPath === p);
    // The CBT surface (/cbt, /cbt/login, /cbt/r/*) is a fully separate app with
    // its own auth: cbt_teacher sessions + anonymous participant tokens, gated
    // server-side by the middleware role policy. This Origin AuthContext never
    // tracks a cbt_teacher, so — exactly like /admin — it must not apply its
    // "unauthenticated → home" guard here, or it bounces the OTP login page and
    // logged-in CBT teachers back to the Origin landing page.
    const isCbtSurface = normalizedPath === '/cbt' || normalizedPath.startsWith('/cbt/');

    // 1. Unauthenticated users: redirect away from protected pages
    if (!user && !isGuestOnlyPath && !isSharedPublicPath && !normalizedPath.startsWith('/admin') && !isCbtSurface) {
      window.location.href = '/';
      return;
    }

    // 2. Authenticated users: redirect away from guest pages
    if (user && isGuestOnlyPath) {
      if (user.role === 'student' && !user.isOnboarded) {
        router.push('/onboarding');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'teacher') {
        router.push('/teacher');
      } else {
        router.push('/dashboard');
      }
    }
  }, [pathname, user, isLoading, isHydrating, authRecoveryBlocked, router]);

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

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      // Load this user's sound prefs and play the sign-in cue.
      setSoundPreferences(result.user.soundPreferences ?? null);
      playCategory('signIn');
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else if (result.user.role === 'teacher') {
        router.push('/teacher');
      } else {
        router.push('/dashboard');
      }
      track('login', { method: 'password', role: result.user.role });
      toast.success('Welcome back to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOtp = async (email: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await loginWithOtpAction({ email, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      // Load this user's sound prefs and play the sign-in cue.
      setSoundPreferences(result.user.soundPreferences ?? null);
      playCategory('signIn');
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'admin') {
        router.push('/admin');
      } else if (result.user.role === 'teacher') {
        router.push('/teacher');
      } else {
        router.push('/dashboard');
      }
      track('login', { method: 'otp', role: result.user.role });
      toast.success('Welcome back to ORIGIN!');
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, mobile: string, state: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await registerAction({ name, email, password, mobile, state, role: role ?? null });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      clearOriginAiBrowserSession();

      setAuthRecoveryBlocked(false);
      setUser(result.user);
      // Load this user's sound prefs and play the sign-in cue.
      setSoundPreferences(result.user.soundPreferences ?? null);
      playCategory('signIn');
      if (result.user.streakData) setStreakData(result.user.streakData);
      setUserRole(normalizeRole(result.user.role));

      tasksFetched.current = false;
      await fetchTasks();

      if (result.user.role === 'student' && !result.user.isOnboarded) {
        router.push('/onboarding');
      } else if (result.user.role === 'admin') {
        router.push('/admin');
      } else if (result.user.role === 'teacher') {
        router.push('/teacher');
      } else {
        router.push('/dashboard');
      }
      track('sign_up', { method: 'password', role: result.user.role });
      toast.success('Registration successful! Welcome to ORIGIN!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (email: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    try {
      const result = await sendOtpAction(email, role ?? null);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const result = await verifyOtpAction(email, otp);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify OTP';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  // Google login found no account → hold the verified identity + credential so
  // AuthPage can collect the mandatory details and finish via googleSignup.
  const [pendingGoogleSignup, setPendingGoogleSignup] = useState<{ email: string; name: string } | null>(null);
  const pendingGoogleCredentialRef = useRef<{ credential: string; role: 'student' | 'teacher' | 'admin' | null } | null>(null);

  /** Shared post-auth success path for Google login AND Google signup. */
  const completeGoogleAuth = async (authedUser: User): Promise<void> => {
    clearOriginAiBrowserSession();
    // Android shell: persist the fresh session cookies to disk immediately
    // (plan ledger #14) — no-op in browsers.
    void flushNativeCookies();

    setAuthRecoveryBlocked(false);
    setUser(authedUser);
    // Load this user's sound prefs and play the sign-in cue.
    setSoundPreferences(authedUser.soundPreferences ?? null);
    playCategory('signIn');
    if (authedUser.streakData) setStreakData(authedUser.streakData);
    setUserRole(normalizeRole(authedUser.role));

    tasksFetched.current = false;
    await fetchTasks();

    if (authedUser.role === 'student' && !authedUser.isOnboarded) {
      router.push('/onboarding');
    } else if (authedUser.role === 'admin') {
      router.push('/admin');
    } else if (authedUser.role === 'teacher') {
      router.push('/teacher');
    } else {
      router.push('/dashboard');
    }
    track('login', { method: 'google', role: authedUser.role });
    toast.success('Google login successful! Welcome to ORIGIN!');
  };

  const googleLogin = async (credential: string, role?: 'student' | 'teacher' | 'admin' | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await googleLoginAction({ credential, role: role ?? null });
      if (!result.ok) {
        // New Google user: switch to the "complete your profile" step instead
        // of a dead-end error. The credential is held for the signup call.
        if (result.needsGoogleSignup && result.email) {
          pendingGoogleCredentialRef.current = { credential, role: role ?? null };
          setPendingGoogleSignup({ email: result.email, name: result.name ?? '' });
          return;
        }
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      await completeGoogleAuth(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Login failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignup = async (mobile: string, state: string) => {
    const pending = pendingGoogleCredentialRef.current;
    if (!pending) {
      toast.error('Google session expired — please tap "Continue with Google" again.');
      setPendingGoogleSignup(null);
      return;
    }
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await googleSignupAction({
        credential: pending.credential,
        role: pending.role,
        mobile,
        state,
      });
      if (!result.ok) {
        setAuthError(result.message);
        toast.error(result.message);
        return;
      }

      pendingGoogleCredentialRef.current = null;
      setPendingGoogleSignup(null);
      await completeGoogleAuth(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-up failed';
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelGoogleSignup = () => {
    pendingGoogleCredentialRef.current = null;
    setPendingGoogleSignup(null);
  };

  const logout = async () => {
    // 1. Clear client state immediately
    clearOriginAiBrowserSession();
    setTasks([]);
    tasksFetched.current = false;

    // Android shell cleanup: invalidate this device's FCM token natively so
    // the phone stops receiving this account's pushes (shared devices — plan
    // ledger #18/#54). Best-effort and fast; no-op in browsers.
    await notifyNativeLogout();

    // Offline-layer hygiene: cached pages/RSC payloads hold this user's data
    // — wipe the runtime caches + IndexedDB before the next person on this
    // device signs in (plan §6.5, ledger #18). Time-boxed inside.
    await purgeUserCachesForLogout();

    try {
      // 2. Clear server-side cookies and revalidate
      await logoutAction();
    } catch (error) {
      console.error('Server-side logout failed:', error);
    }

    // 3. Finally clear the user state which might trigger re-renders
    setUser(null);
    setUserRole(null);
    setAuthRecoveryBlocked(false);

    // 4. Force hard redirect to landing page to purge any remaining memory state
    window.location.href = '/';
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

  const editTask = async (id: string, text: string) => {
    const original = tasks.find(t => t.id === id);
    if (!original) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
    try {
      await editTaskAction(id, text);
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
      loginWithOtp,
      register,
      googleLogin,
      pendingGoogleSignup,
      googleSignup,
      cancelGoogleSignup,
      logout,
      refreshUser,
      addTask,
      editTask,
      toggleTask,
      removeTask,
      primeTasks,
      isNavigationLocked,
      setIsNavigationLocked,
      sendOtp,
      verifyOtp,
      studyMode,
      studyModeExplicit,
      studyModeAvailable,
      availableStudyModes,
      studyModePrompted,
      studyModePending: pendingStudyMode != null,
      setStudyMode,
      dismissStudyModePrompt,
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
