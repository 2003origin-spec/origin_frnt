'use client';

import React, { useEffect, useState, use } from 'react';
import TestInterface from '@/sections/TestInterface';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api';
import type { Test, TestResult } from '@/types';
import { toast } from 'sonner';

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const test = await apiCall(`/assessments/tests/${id}`);
        setTest(test);
      } catch {
        toast.error('Test not found');
        router.push('/tests');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [id, router]);

  const handleComplete = async (result: TestResult) => {
    sessionStorage.setItem(`origin_test_result_${id}`, JSON.stringify(result));
    await refreshUser();
    router.push(`/tests/${id}/result`);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading Test...</div>;
  if (!test) return null;

  return (
    <TestInterface
      test={test}
      onComplete={handleComplete}
      onExit={() => router.push('/tests')}
    />
  );
}
