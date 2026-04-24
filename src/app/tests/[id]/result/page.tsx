import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { listTestResultsForRender } from '@/server/render-loaders';
import type { TestResult } from '@/types';
import ResultClient from './_client';

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-slate-400">
          Analyzing Results...
        </div>
      }
    >
      <ResultContent params={params} />
    </Suspense>
  );
}

async function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect(`/auth?next=/tests/${id}/result`);

  let initialHistory: TestResult[] = [];
  try {
    initialHistory = (await listTestResultsForRender(user.id, id)) as unknown as TestResult[];
  } catch {
    // Client leaf will do a final fallback fetch.
  }

  return <ResultClient testId={id} initialHistory={initialHistory} />;
}
