export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { getContest } from '@/server/contest/contest-admin-service';
import { ContestParticipants } from '@/components/admin/ContestParticipants';

export default async function ContestParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user || user.role !== 'admin') notFound();
  const { id } = await params;
  const contest = await getContest(id).catch(() => null);
  if (!contest) notFound();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <ContestParticipants contestId={id} contestName={contest.name} />
    </div>
  );
}
