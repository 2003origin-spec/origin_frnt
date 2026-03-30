'use client';

import MilestonesPage from '@/sections/MilestonesPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Milestones() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <MilestonesPage
      userPoints={user.points || 0}
      onBack={() => router.back()}
    />
  );
}
