export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { listContests } from '@/server/contest/contest-admin-service';
import { AdminContestPanel } from '@/components/admin/AdminContestPanel';

export default async function AdminContestPage() {
  if (!isFeatureEnabled('contest')) notFound();
  // Fail soft: a schema-not-yet-migrated or transient DB error must not 500 the
  // whole admin surface — render the builder with an empty list instead.
  let contests: Awaited<ReturnType<typeof listContests>> = [];
  try {
    contests = await listContests();
  } catch (err) {
    console.error('[admin/contest] listContests failed:', err);
  }
  return <AdminContestPanel initial={contests} questionTypesEnabled={isFeatureEnabled('contestQuestionTypes')} />;
}
