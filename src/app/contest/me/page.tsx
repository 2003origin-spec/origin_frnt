import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ContestProfile } from '@/components/contest/ContestProfile';

export const metadata: Metadata = {
  title: 'My ORBIT — Origin',
  robots: { index: false, follow: false },
};

export default function ContestProfilePage() {
  if (!isFeatureEnabled('contest')) notFound();
  return <ContestProfile />;
}
