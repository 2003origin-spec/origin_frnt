import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestDpp } from '@/components/contest/ContestDpp';

export const metadata: Metadata = {
  title: 'Practice Your Mistakes — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestDppPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestDpp contestId={id} />;
}
