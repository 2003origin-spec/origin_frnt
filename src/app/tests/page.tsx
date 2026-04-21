import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { readStore } from '@/server/store';
import { listTests } from '@/server/assessments';
import TestsClient from './_client';
import type { Test } from '@/types';

export default async function TestsPage() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/auth?next=/tests');

  let initialTests: Test[] = [];
  try {
    const store = readStore();
    // Direct server function call — zero HTTP round-trip
    initialTests = (await listTests(store, serverUser)) as unknown as Test[];
  } catch {
    // Fall back gracefully; TestList will fetch client-side on mount
  }

  return <TestsClient initialTests={initialTests} />;
}
