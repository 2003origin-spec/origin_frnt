'use client';

import React, { useEffect, useState } from 'react';
import TestResultView from '@/sections/TestResultView';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api';
import type { TestResult } from '@/types';
import { toast } from 'sonner';

interface Props {
  testId: string;
  /** Server-seeded history of results for this test (may be empty). */
  initialHistory: TestResult[];
}

export default function ResultClient({ testId, initialHistory }: Props) {
  const router = useRouter();
  // Prefer the hot result stashed in sessionStorage by TestPage right before navigation;
  // fall back to server-seeded history.
  const [testResult, setTestResult] = useState<TestResult | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = window.sessionStorage.getItem(`origin_test_result_${testId}`);
      if (cached) {
        try {
          const parsed: TestResult = JSON.parse(cached);
          window.sessionStorage.removeItem(`origin_test_result_${testId}`);
          return parsed;
        } catch {
          window.sessionStorage.removeItem(`origin_test_result_${testId}`);
        }
      }
    }
    return initialHistory[0] ?? null;
  });
  const [testHistory, setTestHistory] = useState<TestResult[]>(() =>
    testResult ? [testResult, ...initialHistory.filter((r) => r !== testResult)] : initialHistory,
  );

  useEffect(() => {
    // If neither sessionStorage nor SSR payload produced a result, fall back to a client fetch.
    if (testResult || initialHistory.length > 0) return;
    (async () => {
      try {
        const results = await apiCall(`/assessments/tests/${testId}/results/`);
        if (results && results.length > 0) {
          setTestResult(results[0]);
          setTestHistory(results);
        } else {
          toast.error('No results found for this test.');
          router.push('/tests');
        }
      } catch {
        toast.error('Error loading test analysis.');
        router.push('/tests');
      }
    })();
  }, [testId, router, testResult, initialHistory.length]);

  if (!testResult) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Analyzing Results...
      </div>
    );
  }

  return (
    <TestResultView
      result={testResult}
      history={testHistory}
      showSummary={true}
      onBackToDashboard={() => router.push('/dashboard')}
      onViewDPP={() => router.push('/dpp')}
      onRetakeTest={() => router.push(`/tests/${testId}`)}
    />
  );
}
