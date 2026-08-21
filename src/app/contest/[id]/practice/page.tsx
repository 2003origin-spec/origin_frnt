import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestPractice } from '@/components/contest/ContestPractice';

export const metadata: Metadata = {
  title: 'Contest Practice — Origin',
  robots: { index: false, follow: false },
};

export default async function ContestPracticePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;
  return <ContestPractice contestId={id} />;
}
