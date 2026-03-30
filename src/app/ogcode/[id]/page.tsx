'use client';

import React, { use } from 'react';
import OGCodeWorkspace from '@/sections/OGCodeWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';

export default function OGCodeWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { setTimeMode } = useTimeTracker(!!user);

  if (!user || !id) return null;

  return (
    <OGCodeWorkspace
      questionId={id}
      onBack={() => router.back()}
      user={user}
      onRefreshUser={refreshUser}
      setTimeMode={setTimeMode}
    />
  );
}
