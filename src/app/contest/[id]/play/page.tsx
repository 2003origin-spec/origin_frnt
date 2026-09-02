import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestPlayer } from '@/components/contest/ContestPlayer';

export const metadata: Metadata = {
  title: 'Contest — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestPlayPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestPlayer contestId={id} proctoringEnabled={isFeatureEnabled('contestProctoring')} />;
}
