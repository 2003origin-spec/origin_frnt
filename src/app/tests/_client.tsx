'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/hooks/useAppBack';
import TestList from '@/sections/TestList';
import type { ExamPresetCard } from '@/components/test/ExamPresetCards';
import type { TestPreview } from '@/types';

interface TestsClientProps {
  initialTests: TestPreview[];
  /** Full-length exam presets, already entitlement-resolved on the server. */
  examPresets?: ExamPresetCard[];
  /** Subjects the student is entitled to — the Custom Test Builder unlock set. */
  ownedSubjects?: string[];
}

export default function TestsClient({ initialTests, examPresets, ownedSubjects }: TestsClientProps) {
  // AuthProvider is seeded from the server layout, so `user` is non-null on first render.
  const { user } = useAuth();
  const router = useRouter();
  const goBack = useAppBack();

  return (
    <TestList
      user={user!}
      initialTests={initialTests}
      examPresets={examPresets}
      ownedSubjects={ownedSubjects}
      onStartTest={(test) => router.push(`/tests/${test.id}`)}
      onViewAnalysis={(test) => router.push(`/tests/${test.id}/result`)}
      onBack={goBack}
    />
  );
}
