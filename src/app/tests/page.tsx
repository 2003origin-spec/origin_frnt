'use client';

import TestList from '@/sections/TestList';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiCall } from '@/lib/api';
import { toast } from 'sonner';
import type { Test } from '@/types';

export default function TestsPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleStartTest = (test: Test) => {
    router.push(`/tests/${test.id}`);
  };

  const handleViewAnalysis = async (test: Test) => {
    // In many apps, this would navigate to a results page
    router.push(`/tests/${test.id}/result`);
  };

  return (
    <TestList
      user={user}
      onStartTest={handleStartTest}
      onViewAnalysis={handleViewAnalysis}
      onBack={() => router.push('/dashboard')}
    />
  );
}
