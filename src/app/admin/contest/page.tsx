export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { listContests } from '@/server/contest/contest-admin-service';
import { AdminContestPanel } from '@/components/admin/AdminContestPanel';

export default async function AdminContestPage() {
  if (!isFeatureEnabled('contest')) notFound();
  const contests = await listContests();
  return <AdminContestPanel initial={contests} />;
}
