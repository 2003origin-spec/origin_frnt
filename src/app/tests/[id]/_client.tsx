'use client';

import React from 'react';
import TestInterface from '@/sections/TestInterface';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { Test, TestResult } from '@/types';

interface Props {
  testId: string;
  initialTest: Test;
}

export default function TestClient({ testId, initialTest }: Props) {
  const { refreshUser } = useAuth();
  const router = useRouter();

  const handleComplete = async (result: TestResult) => {
    sessionStorage.setItem(`origin_test_result_${testId}`, JSON.stringify(result));
    void refreshUser();
    router.push(`/tests/${testId}/result`);
  };

  return (
    <TestInterface
      test={initialTest}
      onComplete={handleComplete}
      onExit={() => router.push('/tests')}
    />
  );
}
