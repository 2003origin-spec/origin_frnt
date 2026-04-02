'use client';

import OriginAiMentor from '@/components/origin-ai/OriginAiMentor';
import { useAuth } from '@/context/AuthContext';

export default function DoubtSolverPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#040b16] px-4 py-6 sm:px-6 lg:px-10">
      <OriginAiMentor />
    </div>
  );
}
