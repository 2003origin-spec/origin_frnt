import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { OrbitLeaderboard } from '@/components/contest/OrbitLeaderboard';

export const metadata: Metadata = {
  title: 'ORBIT Rankings — Origin',
  robots: { index: false, follow: false },
};

export default function OrbitRankingsPage() {
  if (!isFeatureEnabled('contest')) notFound();
  return <OrbitLeaderboard />;
}
