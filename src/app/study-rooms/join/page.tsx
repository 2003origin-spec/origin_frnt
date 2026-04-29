import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import JoinStudyRoomClient from './_client';

export default async function JoinStudyRoomPage() {
  const user = await getServerUser();
  if (!user) redirect('/auth?next=/study-rooms/join');
  return <JoinStudyRoomClient />;
}
