'use client';

import DPPView from '@/sections/DPPView';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function DPPPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <DPPView
      user={user}
      onBack={() => router.push('/dashboard')}
    />
  );
}
