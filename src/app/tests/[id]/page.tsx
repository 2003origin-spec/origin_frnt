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
        const tests = await apiCall('/assessments/tests/');
        const foundTest = tests.find((t: Test) => t.id.toString() === id);
        if (foundTest) {
          setTest(foundTest);
        } else {
          toast.error('Test not found');
          router.push('/tests');
        }
      } catch (error) {
        console.error('Failed to fetch test:', error);
        toast.error('Error loading test');
        router.push('/tests');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [id, router]);

  const handleComplete = async (result: TestResult) => {
    // In original project, this navigated to test-result
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
