'use client';

import DoubtSolver from '@/sections/DoubtSolver';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/hooks/useAppBack';

export default function DoubtSolverClient() {
  const goBack = useAppBack();
  const { user } = useAuth();

  if (!user) return null;

  return <DoubtSolver user={user} onBack={goBack} />;
}
