'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { mutateJson } from '@/lib/csrf';

interface QuotaState {
  voiceSecondsUsed: number;
  textTokensUsed: number;
  lastResetDate: string;
}

interface QuotaContextType {
  voiceSecondsUsed: number;
  textTokensUsed: number;
  voiceLimitSeconds: number;
  textLimitTokens: number;
  isVoiceQuotaReached: boolean;
  isTextQuotaReached: boolean;
  addTextUsage: (tokens: number) => void;
  startVoiceTracking: () => void;
  stopVoiceTracking: () => void;
  getRemainingVoiceTime: () => string;
  getRemainingTokens: () => string;
  voiceProgress: number;
  textProgress: number;
}

const VOICE_LIMIT_SECONDS = 10 * 60; // 10 minutes
const TEXT_LIMIT_TOKENS = 200000; // 200k tokens
const EMPTY_QUOTA_STATE: QuotaState = {
  voiceSecondsUsed: 0,
  textTokensUsed: 0,
  lastResetDate: '',
};

const QuotaContext = createContext<QuotaContextType | undefined>(undefined);

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function isToday(value: string | Date | null | undefined): boolean {
  if (!value) {
    return true;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return date.toISOString().split('T')[0] === todayString();
}

function quotaFromUser(user: ReturnType<typeof useAuth>['user']): QuotaState | null {
  if (!user) {
    return null;
  }

  if (!isToday(user.usageResetAt)) {
    return {
      voiceSecondsUsed: 0,
      textTokensUsed: 0,
      lastResetDate: todayString(),
    };
  }

  return {
    voiceSecondsUsed: Math.round((user.voiceMinutesUsedToday ?? 0) * 60),
    textTokensUsed: user.tokensUsedToday ?? 0,
    lastResetDate: todayString(),
  };
}

async function reportVoiceUsageMinutes(voiceMinutes: number): Promise<void> {
  if (!(voiceMinutes > 0)) return;
  try {
    await mutateJson('/api/origin-ai/voice/usage', {
      method: 'POST',
      body: JSON.stringify({ voiceMinutes }),
    });
  } catch (error) {
    console.error('Failed to persist voice usage', error);
  }
}

export function QuotaProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuotaState>(EMPTY_QUOTA_STATE);

  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedThresholds = useRef<Set<string>>(new Set());
  const lastFlushedVoiceSecondsRef = useRef(0);
  const voiceSecondsRef = useRef(0);
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const storageKey = user?.id ? `origin_ai_quota_${user.id}` : 'origin_ai_quota_guest';

  // Load from localStorage when user or storageKey changes, then anchor to server usage.
  useEffect(() => {
    notifiedThresholds.current.clear();

    const serverState = quotaFromUser(user);
    if (serverState) {
      setState(serverState);
      voiceSecondsRef.current = serverState.voiceSecondsUsed;
      lastFlushedVoiceSecondsRef.current = serverState.voiceSecondsUsed;
      localStorage.setItem(storageKey, JSON.stringify(serverState));
      return;
    }

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as QuotaState;
        const today = todayString();

        if (parsed.lastResetDate !== today) {
          const newState = {
            voiceSecondsUsed: 0,
            textTokensUsed: 0,
            lastResetDate: today,
          };
          setState(newState);
          voiceSecondsRef.current = 0;
          lastFlushedVoiceSecondsRef.current = 0;
          localStorage.setItem(storageKey, JSON.stringify(newState));
        } else {
          setState(parsed);
          voiceSecondsRef.current = parsed.voiceSecondsUsed;
          lastFlushedVoiceSecondsRef.current = parsed.voiceSecondsUsed;
        }
      } catch (e) {
        console.error('Failed to parse quota state', e);
      }
    } else {
      const freshState = {
        voiceSecondsUsed: 0,
        textTokensUsed: 0,
        lastResetDate: todayString(),
      };
      setState(freshState);
      voiceSecondsRef.current = 0;
      lastFlushedVoiceSecondsRef.current = 0;
      localStorage.setItem(storageKey, JSON.stringify(freshState));
    }
  }, [storageKey, user]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    voiceSecondsRef.current = state.voiceSecondsUsed;
  }, [state, storageKey]);

  const flushVoiceUsage = useCallback(async () => {
    const current = voiceSecondsRef.current;
    const deltaSeconds = current - lastFlushedVoiceSecondsRef.current;
    if (deltaSeconds < 1) return;
    lastFlushedVoiceSecondsRef.current = current;
    await reportVoiceUsageMinutes(deltaSeconds / 60);
  }, []);

  const checkNotifications = useCallback((type: 'voice' | 'text', used: number, limit: number) => {
    const progress = (used / limit) * 100;
    const thresholds = [50, 75, 90, 100];

    thresholds.forEach(threshold => {
      const key = `${type}-${threshold}`;
      if (progress >= threshold && !notifiedThresholds.current.has(key)) {
        if (threshold === 100) {
          toast.error(`Daily ${type} quota reached!`, {
            description: `You have used 100% of your daily ${type} limit.`,
          });
          addNotification({
            title: `Daily ${type} Quota Exhausted`,
            message: `You have reached 100% of your daily ${type} limit for Ori.`,
            type: 'warning'
          });
        } else {
          toast.warning(`Daily ${type} quota alert`, {
            description: `You have used ${threshold}% of your daily ${type} limit.`,
          });
        }
        notifiedThresholds.current.add(key);
      }
    });

    if (progress === 0) {
      notifiedThresholds.current.clear();
    }
  }, [addNotification]);

  const addTextUsage = useCallback((tokens: number) => {
    setState(prev => {
      const nextUsed = prev.textTokensUsed + tokens;
      checkNotifications('text', nextUsed, TEXT_LIMIT_TOKENS);
      return { ...prev, textTokensUsed: nextUsed };
    });
  }, [checkNotifications]);

  const startVoiceTracking = useCallback(() => {
    if (voiceTimerRef.current) return;

    voiceTimerRef.current = setInterval(() => {
      setState(prev => {
        const nextUsed = prev.voiceSecondsUsed + 1;
        checkNotifications('voice', nextUsed, VOICE_LIMIT_SECONDS);

        if (nextUsed >= VOICE_LIMIT_SECONDS) {
          if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
          }
        }

        return { ...prev, voiceSecondsUsed: nextUsed };
      });
    }, 1000);

    // Persist voice minutes every 30s so DB history stays current mid-call.
    if (!flushTimerRef.current) {
      flushTimerRef.current = setInterval(() => {
        void flushVoiceUsage();
      }, 30_000);
    }
  }, [checkNotifications, flushVoiceUsage]);

  const stopVoiceTracking = useCallback(() => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    void flushVoiceUsage();
  }, [flushVoiceUsage]);

  useEffect(() => {
    const onHide = () => {
      void flushVoiceUsage();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      void flushVoiceUsage();
    };
  }, [flushVoiceUsage]);

  const getRemainingVoiceTime = useCallback(() => {
    const remaining = Math.max(0, VOICE_LIMIT_SECONDS - state.voiceSecondsUsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}m ${secs}s remaining`;
  }, [state.voiceSecondsUsed]);

  const getRemainingTokens = useCallback(() => {
    const remaining = Math.max(0, TEXT_LIMIT_TOKENS - state.textTokensUsed);
    return `${remaining.toLocaleString()} tokens remaining`;
  }, [state.textTokensUsed]);

  const voiceProgress = (state.voiceSecondsUsed / VOICE_LIMIT_SECONDS) * 100;
  const textProgress = (state.textTokensUsed / TEXT_LIMIT_TOKENS) * 100;

  const value = {
    voiceSecondsUsed: state.voiceSecondsUsed,
    textTokensUsed: state.textTokensUsed,
    voiceLimitSeconds: VOICE_LIMIT_SECONDS,
    textLimitTokens: TEXT_LIMIT_TOKENS,
    isVoiceQuotaReached: state.voiceSecondsUsed >= VOICE_LIMIT_SECONDS,
    isTextQuotaReached: state.textTokensUsed >= TEXT_LIMIT_TOKENS,
    addTextUsage,
    startVoiceTracking,
    stopVoiceTracking,
    getRemainingVoiceTime,
    getRemainingTokens,
    voiceProgress,
    textProgress,
  };

  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>;
}

export function useQuota() {
  const context = useContext(QuotaContext);
  if (context === undefined) {
    throw new Error('useQuota must be used within a QuotaProvider');
  }
  return context;
}
