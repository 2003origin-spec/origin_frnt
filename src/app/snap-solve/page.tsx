import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import SnapSolveClient from './_client';

export default function SnapSolvePage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <SnapSolveGate />
    </Suspense>
  );
}

async function SnapSolveGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <SnapSolveClient />;
}
