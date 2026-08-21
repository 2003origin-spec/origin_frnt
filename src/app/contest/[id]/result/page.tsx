import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestResult } from '@/components/contest/ContestResult';

export const metadata: Metadata = {
  title: 'Contest Result — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestResultPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestResult contestId={id} />;
}
