'use client';

import OGCodeList from '@/sections/OGCodeList';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function OGCodePage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleSelectQuestion = (id: string) => {
    if (id === 'leaderboard') {
      router.push('/leaderboard');
    } else {
      router.push(`/ogcode/${id}`);
    }
  };

  return (
    <OGCodeList
      user={user}
      onSelectQuestion={handleSelectQuestion}
    />
  );
}
