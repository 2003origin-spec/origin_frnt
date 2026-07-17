import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import Grapher from '@/sections/Grapher';

export default async function GraphsPage() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <Grapher />;
}
