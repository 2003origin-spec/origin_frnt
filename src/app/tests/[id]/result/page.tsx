'use client';

import React, { useEffect, useState, use } from 'react';
import TestResultView from '@/sections/TestResultView';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api';
import type { TestResult } from '@/types';
import { toast } from 'sonner';

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const results = await apiCall(`/assessments/tests/${id}/results/`);
        if (results && results.length > 0) {
          setTestResult(results[0]);
          setTestHistory(results);
        } else {
          toast.error('No results found for this test.');
          router.push('/tests');
        }
      } catch (error) {
        console.error('Failed to fetch test result:', error);
        toast.error('Error loading test analysis.');
        router.push('/tests');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [id, router]);

  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-400">Analyzing Results...</div>;
  if (!testResult) return null;

  return (
    <TestResultView
      result={testResult}
      history={testHistory}
      showSummary={true}
      onBackToDashboard={() => router.push('/dashboard')}
      onViewDPP={() => router.push('/dpp')}
      onRetakeTest={() => router.push('/tests')}
    />
  );
}
