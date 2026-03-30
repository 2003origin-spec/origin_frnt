'use client';

import DoubtSolver from '@/sections/DoubtSolver';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function DoubtSolverPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <DoubtSolver
      user={user}
      onBack={() => router.push('/dashboard')}
    />
  );
}
