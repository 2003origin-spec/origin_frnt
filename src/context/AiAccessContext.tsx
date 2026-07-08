'use client';

/**
 * AI Feature Toggle epic — client-side AI access state (cosmetic; the server is
 * the authority). Seeded from SSR (no flash), then for students only: poll
 * GET /api/ai-access/me every 60s + on window focus/visibility, and hide
 * instantly when any AI call 403s with code AI_DISABLED. Non-students never
 * render AI and never poll. doc 06 §1.
 */

import React from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { apiCall } from '@/lib/api';
import { setAiDisabledHandler } from '@/features/origin-ai/ai-access-client';

export type AiAccessState = { originAi: boolean; aiExplainer: boolean };

type AiAccessContextValue = AiAccessState & {
  markDisabled: () => void;
  refresh: () => Promise<void>;
};

const FALLBACK: AiAccessContextValue = {
  originAi: false,
  aiExplainer: false,
  markDisabled: () => {},
  refresh: async () => {},
};

const POLL_INTERVAL_MS = 60_000;
const FOCUS_MIN_SPACING_MS = 15_000;

const AiAccessContext = React.createContext<AiAccessContextValue | null>(null);

export function AiAccessProvider({
  initial,
  children,
}: {
  initial: AiAccessState;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const isStudent = !!user && user.role === 'student';
  const [state, setState] = React.useState<AiAccessState>(initial);
  const lastFetchRef = React.useRef(0);
  const hasToastedRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!isStudent) return;
    try {
      lastFetchRef.current = Date.now();
      const data = (await apiCall('/ai-access/me')) as Partial<AiAccessState>;
      const next = { originAi: !!data.originAi, aiExplainer: !!data.aiExplainer };
      setState(next);
      // Re-arm the deduped toast once access is restored.
      if (next.originAi || next.aiExplainer) hasToastedRef.current = false;
    } catch {
      // Keep the last known state on a transient failure.
    }
  }, [isStudent]);

  const markDisabled = React.useCallback(() => {
    setState({ originAi: false, aiExplainer: false });
    if (!hasToastedRef.current) {
      hasToastedRef.current = true;
      toast.error('AI features have been turned off by your administrator.');
    }
  }, []);

  // Students converge on the current user (covers SPA login where the SSR seed
  // is stale). No flash — initial renders first and this refetch returns the
  // same value on a normal load. Non-students are handled at render (below),
  // so there is no setState here.
  React.useEffect(() => {
    if (isStudent) void refresh();
  }, [isStudent, user?.id, refresh]);

  // Register the non-React bridge so the fetch client can hide instantly on 403.
  React.useEffect(() => {
    if (!isStudent) return;
    setAiDisabledHandler(markDisabled);
    return () => setAiDisabledHandler(null);
  }, [isStudent, markDisabled]);

  // 60s poll + focus/visibility refetch (min spacing 15s).
  React.useEffect(() => {
    if (!isStudent) return;
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onFocus = () => {
      if (Date.now() - lastFetchRef.current > FOCUS_MIN_SPACING_MS) void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isStudent, refresh]);

  const value = React.useMemo<AiAccessContextValue>(() => {
    // Non-students never see AI — override the (unused) student state at render.
    const effective = isStudent ? state : { originAi: false, aiExplainer: false };
    return { ...effective, markDisabled, refresh };
  }, [isStudent, state, markDisabled, refresh]);

  return <AiAccessContext.Provider value={value}>{children}</AiAccessContext.Provider>;
}

export function useAiAccess(): AiAccessContextValue {
  return React.useContext(AiAccessContext) ?? FALLBACK;
}
