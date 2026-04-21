'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import MilestonesPage from '@/sections/MilestonesPage';

interface MilestonesClientProps {
  initialPoints: number;
}

export default function MilestonesClient({ initialPoints }: MilestonesClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <MilestonesPage
      userPoints={initialPoints}
      onBack={() => router.back()}
    />
  );
}
