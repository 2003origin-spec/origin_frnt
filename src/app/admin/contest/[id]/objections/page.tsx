export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { listKeyObjections } from '@/server/contest/contest-objection-service';
import { ContestObjectionsAdmin } from '@/components/admin/ContestObjectionsAdmin';

export default async function ContestObjectionsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user || user.role !== 'admin') notFound();
  const { id } = await params;
  let objections: Awaited<ReturnType<typeof listKeyObjections>> = [];
  try { objections = await listKeyObjections(id); } catch (err) { console.error('[admin/objections]', err); }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ContestObjectionsAdmin contestId={id} initial={objections} />
    </div>
  );
}
