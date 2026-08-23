import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestAttemptReview } from '@/components/contest/ContestAttemptReview';

export const metadata: Metadata = {
  title: 'Solutions — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestSolutionsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestAttemptReview contestId={id} />;
}
