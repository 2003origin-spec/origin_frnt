export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { getContestCertificate } from '@/server/contest/contest-certificate-service';
import { ContestCertificate } from '@/components/contest/ContestCertificate';

export default async function ContestCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user) redirect('/auth?next=/contest');
  const { id } = await params;
  const cert = await getContestCertificate(id, user.id);
  if (!cert) notFound();
  return <ContestCertificate cert={cert} />;
}
