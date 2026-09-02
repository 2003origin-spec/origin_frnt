export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { getContestImportJob } from '@/server/contest/contest-import-service';
import { ContestImportReview } from '@/components/admin/ContestImportReview';

export default async function ContestImportReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user || user.role !== 'admin') notFound();

  const { jobId } = await params;
  const result = await getContestImportJob(user.id, jobId);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ContestImportReview jobId={jobId} job={result.job} initialQuestions={result.questions} />
    </div>
  );
}
