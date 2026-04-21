import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { readStore } from '@/server/store';
import { buildPointsSummary } from '@/server/gamification';
import MilestonesClient from './_client';

export default async function MilestonesPage() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/auth?next=/milestones');

  let initialPoints = 0;
  try {
    const store = readStore();
    initialPoints = buildPointsSummary(store, serverUser.id).totalPoints;
  } catch {
    // MilestonesPage will fetch points client-side via /users/points/
  }

  return <MilestonesClient initialPoints={initialPoints} />;
}
