import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestList } from '@/components/contest/ContestList';

export const metadata: Metadata = {
  title: 'Weekly Contests — Origin',
  robots: { index: false, follow: false },
};

export default function ContestsPage() {
  if (!isFeatureEnabled('contest')) notFound();
  return <ContestList />;
}
