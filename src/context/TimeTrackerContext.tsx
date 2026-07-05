'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export type TimeType = 'webpage' | 'practice' | 'pomodoro';

interface TimeTrackerContextType {
    setTimeMode: (mode: TimeType, subject?: string) => void;
    timeMode: TimeType;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

const SYNC_INTERVAL = 60000; // 60 seconds

export function TimeTrackerProvider({ children }: { children: React.ReactNode }) {
    const { user, refreshUser } = useAuth();
    const accumulators = useRef<Record<TimeType, number>>({
        webpage: 0,
        practice: 0,
        pomodoro: 0,
    });
    const timeTypeRef = useRef<TimeType>('webpage');
    const activeSubjectRef = useRef<string | null>(null);

    const syncNow = useCallback(() => {
        const types: TimeType[] = ['webpage', 'practice', 'pomodoro'];
        let hasDelta = false;
        for (const tType of types) {
            const secs = accumulators.current[tType];
            if (secs > 0) {
                hasDelta = true;
                const currentSecs = secs;
                accumulators.current[tType] = 0;

                const payload: Record<string, unknown> = { time_type: tType, time_spent: currentSecs };
                if (activeSubjectRef.current) {
                    payload.subject = activeSubjectRef.current;
                }

                apiCall('/users/time/', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).catch(err => {
                    console.error('[TimeTracker] Sync failed:', err);
                });
            }
        }
        // Only refresh the user object when there was an actual delta — avoids
        // a full re-render of every useAuth() consumer on every 60-second tick.
        if (hasDelta && refreshUser) refreshUser();
    }, [refreshUser]);

    const setTimeMode = useCallback((mode: TimeType, subject?: string) => {
        // Sync before switching to avoid mixing time in buffers
        syncNow();
        
        timeTypeRef.current = mode;
        if (subject) {
            activeSubjectRef.current = subject;
        } else if (mode === 'webpage' || mode === 'pomodoro') {
             // In webpage or pomodoro, we might not have a specific "question" subject, 
             // but pomodoro might want to keep the current study subject if any.
             // For now, clear it for webpage.
            if (mode === 'webpage') activeSubjectRef.current = null;
        }
    }, [syncNow]);

    // 1. Tick every second
    useEffect(() => {
        if (!user) return;

        const timer = setInterval(() => {
            const currentType = timeTypeRef.current;
            accumulators.current[currentType] = (accumulators.current[currentType] || 0) + 1;
        }, 1000);

        return () => {
            clearInterval(timer);
            syncNow();
        };
    }, [user, syncNow]);

    // 2. Periodic sync
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(syncNow, SYNC_INTERVAL);
        return () => clearInterval(interval);
    }, [user, syncNow]);

    // 3. Sync on unload — re-registers whenever syncNow identity changes so the
    //    closure always holds the latest refreshUser reference (fixes #13/#15).
    useEffect(() => {
        window.addEventListener('beforeunload', syncNow);
        return () => window.removeEventListener('beforeunload', syncNow);
    }, [syncNow]);

    return (
        <TimeTrackerContext.Provider value={{ setTimeMode, timeMode: timeTypeRef.current }}>
            {children}
        </TimeTrackerContext.Provider>
    );
}

export function useTimeTracker() {
    const context = useContext(TimeTrackerContext);
    if (context === undefined) {
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    }
    return context;
}
