'use client';

import MilestonesPage from '@/sections/MilestonesPage';
import { useAppBack } from '@/hooks/useAppBack';

interface MilestonesClientProps {
  initialPoints: number;
}

export default function MilestonesClient({ initialPoints }: MilestonesClientProps) {
  const goBack = useAppBack();
  return (
    <MilestonesPage
      userPoints={initialPoints}
      onBack={goBack}
    />
  );
}
