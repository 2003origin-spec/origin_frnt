export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { listContestImportJobs } from '@/server/contest/contest-import-service';
import { ContestImportUpload } from '@/components/admin/ContestImportUpload';

export default async function ContestImportPage() {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user || user.role !== 'admin') notFound();

  let jobs: Awaited<ReturnType<typeof listContestImportJobs>> = [];
  try {
    jobs = await listContestImportJobs(user.id);
  } catch (err) {
    console.error('[admin/contest/import] listContestImportJobs failed:', err);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ContestImportUpload initialJobs={jobs} />
    </div>
  );
}
