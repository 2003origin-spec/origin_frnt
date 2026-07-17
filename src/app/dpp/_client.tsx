'use client';

import DPPView from '@/sections/DPPView';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/hooks/useAppBack';
import type { GeneratedDppForRender } from '@/server/render-loaders';

interface DPPClientProps {
  initialDpps: GeneratedDppForRender[] | null;
}

export default function DPPClient({ initialDpps }: DPPClientProps) {
  const { user } = useAuth();
  const goBack = useAppBack();

  if (!user) return null;

  return <DPPView user={user} initialDpps={initialDpps} onBack={goBack} />;
}
