import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestLeaderboard } from '@/components/contest/ContestLeaderboard';

export const metadata: Metadata = {
  title: 'Contest Leaderboard — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestLeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestLeaderboard contestId={id} />;
}
