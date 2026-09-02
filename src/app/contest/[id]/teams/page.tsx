import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestTeams } from '@/components/contest/ContestTeams';

export const metadata: Metadata = { title: 'Contest Teams — Origin', robots: { index: false, follow: false } };

export default async function ContestTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestTeams contestId={id} />;
}
