'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import OGCodeList from '@/sections/OGCodeList';
import type { PracticeQuestion } from '@/types';

interface OGCodeClientProps {
  initialQuestions: PracticeQuestion[];
}

export default function OGCodeClient({ initialQuestions }: OGCodeClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <OGCodeList
      user={user}
      initialQuestions={initialQuestions}
      onSelectQuestion={(id) => {
        if (id === 'leaderboard') {
          router.push('/leaderboard');
        } else {
          router.push(`/ogcode/${id}`);
        }
      }}
    />
  );
}
