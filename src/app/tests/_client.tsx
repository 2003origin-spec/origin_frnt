'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import TestList from '@/sections/TestList';
import type { Test } from '@/types';

interface TestsClientProps {
  initialTests: Test[];
}

export default function TestsClient({ initialTests }: TestsClientProps) {
  const { user } = useAuth();
  const router = useRouter();

  // During SSR → hydration gap, user may still be resolving from AuthContext.
  // We show nothing rather than flash an empty list. This is brief (<100 ms).
  if (!user) return null;

  return (
    <TestList
      user={user}
      initialTests={initialTests}
      onStartTest={(test) => router.push(`/tests/${test.id}`)}
      onViewAnalysis={(test) => router.push(`/tests/${test.id}/result`)}
      onBack={() => router.push('/dashboard')}
    />
  );
}
