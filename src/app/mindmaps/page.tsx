import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import MindmapsClient from './_client';

export default function MindmapsPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <MindmapsGate />
    </Suspense>
  );
}

async function MindmapsGate() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <MindmapsClient />;
}
