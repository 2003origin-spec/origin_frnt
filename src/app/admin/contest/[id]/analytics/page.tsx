export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { getContestQuestionAnalytics } from '@/server/contest/contest-analytics-service';
import { ContestQuestionAnalytics } from '@/components/admin/ContestQuestionAnalytics';

export default async function ContestAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user || user.role !== 'admin') notFound();
  const { id } = await params;
  let rows: Awaited<ReturnType<typeof getContestQuestionAnalytics>> = [];
  try {
    rows = await getContestQuestionAnalytics(id);
  } catch (err) {
    console.error('[admin/contest/analytics] failed:', err);
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ContestQuestionAnalytics contestId={id} rows={rows} />
    </div>
  );
}
