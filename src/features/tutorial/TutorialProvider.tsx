'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PAGES_STEPS, TutorialStep } from './steps';
import { useAiAccess } from '@/context/AiAccessContext';

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

// One-time-ever, per user. Once the user has seen (completed or skipped) the
// tutorial on any page, it never shows again on any page.
const getStorageKey = (userId: string | number) =>
  `origin_tutorial_${userId}_seen`;

function shouldShowTutorial(userId: string | number): boolean {
  try {
    return !localStorage.getItem(getStorageKey(userId)); // show only if never seen
  } catch {
    return false;
  }
}

function markTutorialSeen(userId: string | number): void {
  try {
    localStorage.setItem(getStorageKey(userId), String(Date.now()));
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

    if (!shouldShowTutorial(user.id)) {
      setIsActive(false);
      return;
    }

    const timer = setTimeout(() => setIsActive(true), 1200);
    return () => clearTimeout(timer);
  }, [pathname, user]);

  // AI Feature Toggle epic — drop the AI Explainer walkthrough step when the
  // Explainer is disabled for this student (its target nav item is hidden). doc 06 §3.
  const { aiExplainer } = useAiAccess();
  const steps = (activePage ? (PAGES_STEPS[activePage] ?? []) : []).filter(
    (s) => aiExplainer || s.targetId !== 'tutorial-nav-doubt-solver',
  );

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
      if (user) markTutorialSeen(user.id);
    }
  }, [currentStep, steps.length, activePage, user]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    if (user) markTutorialSeen(user.id);
  }, [user]);

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
