'use client';
import { useEffect, useRef, useCallback } from 'react';
import { apiCall } from '@/lib/api';

// Sync interval: 60 seconds
const SYNC_INTERVAL = 60000;

export type TimeType = 'webpage' | 'practice' | 'pomodoro';

export function useTimeTracker(enabled: boolean = true) {
    // Use refs instead of state for accumulators to avoid triggering re-renders
    // and the race condition where the sync interval keeps getting re-registered
    const accumulators = useRef<Record<TimeType, number>>({
        webpage: 0,
        practice: 0,
        pomodoro: 0,
    });
    const timeTypeRef = useRef<TimeType>('webpage');
    const activeSubjectRef = useRef<string | null>(null);

    // Switch between time modes (stable callback, no re-renders)
    const setTimeMode = useCallback((mode: TimeType, subject?: string) => {
        timeTypeRef.current = mode;
        if (subject) {
            activeSubjectRef.current = subject;
        } else if (mode === 'webpage') {
            activeSubjectRef.current = null;
        }
    }, []);

    // 1. Tick every second and increment the current type's accumulator
    useEffect(() => {
        if (!enabled) return;

        const timer = setInterval(() => {
            const currentType = timeTypeRef.current;
            accumulators.current[currentType] = (accumulators.current[currentType] || 0) + 1;
        }, 1000);

        return () => clearInterval(timer);
    }, [enabled]); // Only depends on `enabled`, no longer on accumulators

    // Helper to sync and clear accumulators
    const syncNow = useCallback(() => {
        const types: TimeType[] = ['webpage', 'practice', 'pomodoro'];
        for (const tType of types) {
            const secs = accumulators.current[tType];
            if (secs > 0) {
                // Clear immediately before the async call to avoid double-sending
                accumulators.current[tType] = 0;

                const payload: any = { time_type: tType, time_spent: secs };
                if (tType === 'practice' && activeSubjectRef.current) {
                    payload.subject = activeSubjectRef.current;
                }

                apiCall('/users/time/', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).catch(console.error);
            }
        }
    }, []);

    // 2. Sync to backend every SYNC_INTERVAL
    useEffect(() => {
        if (!enabled) return;
        const interval = setInterval(syncNow, SYNC_INTERVAL);
        return () => clearInterval(interval);
    }, [enabled, syncNow]); // syncNow is stable, this won't re-register every second

    // 3. Sync on page close (best-effort via beacon)
    useEffect(() => {
        if (!enabled) return;

        const handleBeforeUnload = () => {
            const token = localStorage.getItem('origin_access_token');
            if (!token || !navigator.sendBeacon) {
                syncNow(); // Fallback
                return;
            }
            const types: TimeType[] = ['webpage', 'practice', 'pomodoro'];
            for (const tType of types) {
                const secs = accumulators.current[tType];
                if (secs > 0) {
                    const payload: any = { time_type: tType, time_spent: secs };
                    if (tType === 'practice' && activeSubjectRef.current) {
                        payload.subject = activeSubjectRef.current;
                    }
                    // navigator.sendBeacon doesn't support custom headers, so we fall back to syncNow
                    syncNow();
                    break;
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [enabled, syncNow]);

    return { setTimeMode, timeType: timeTypeRef.current };
}
