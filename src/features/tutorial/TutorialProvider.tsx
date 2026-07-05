'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PAGES_STEPS, TutorialStep } from './steps';

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  startTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getStorageKey = (userId: string | number, page: string) =>
  `origin_tutorial_${userId}_${page}_seen_at`;

function shouldShowTutorial(userId: string | number, page: string): boolean {
  try {
    const raw = localStorage.getItem(getStorageKey(userId, page));
    if (!raw) return true; // never seen — first login
    const lastSeen = Number(raw);
    if (isNaN(lastSeen)) return true; // corrupted
    return Date.now() - lastSeen > WEEK_MS;
  } catch {
    return false;
  }
}

function markTutorialSeen(userId: string | number, page: string): void {
  try {
    localStorage.setItem(getStorageKey(userId, page), String(Date.now()));
  } catch { /* ignore storage errors */ }
}

const getPageFromPath = (path: string): string | null => {
  if (path === '/dashboard') return 'dashboard';
  if (path === '/ogcode') return 'ogcode-list';
  if (path.startsWith('/ogcode')) return 'ogcode-workspace';
  if (path.includes('doubt-solver')) return 'doubt-solver';
  if (path.includes('test-list')) return 'test-list';
  if (path.includes('dpp')) return 'dpp';
  if (path.includes('tasks-goals')) return 'tasks-goals';
  return null;
};

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activePage, setActivePage] = useState<string | null>(null);

  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    const page = getPageFromPath(pathname);
    if (!page || !user) {
      setIsActive(false);
      return;
    }

    setActivePage(page);
    setCurrentStep(0);

    if (!shouldShowTutorial(user.id, page)) {
      setIsActive(false);
      return;
    }

    const timer = setTimeout(() => setIsActive(true), 1200);
    return () => clearTimeout(timer);
  }, [pathname, user]);

  const steps = activePage ? (PAGES_STEPS[activePage] ?? []) : [];

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
      if (activePage && user) markTutorialSeen(user.id, activePage);
    }
  }, [currentStep, steps.length, activePage, user]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    if (activePage && user) markTutorialSeen(user.id, activePage);
  }, [activePage, user]);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return (
    <TutorialContext.Provider value={{ isActive, currentStep, steps, nextStep, prevStep, skipTutorial, startTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial must be used within a TutorialProvider');
  return context;
};
