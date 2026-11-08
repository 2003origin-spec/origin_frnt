import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getTestDetailForRender, openTeacherTestSittingForRender } from '@/server/render-loaders';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import TestWindowNotice from '@/components/test/TestWindowNotice';
import { isTestWindowError } from '@/lib/assessments/test-window';
import type { Test } from '@/types';
import TestClient from './_client';

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <TestContent params={params} />
    </Suspense>
  );
}

async function TestContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialTest: Test;
  try {
    // Teacher-assigned tests: gate the window + record the attempt start on
    // EVERY load (uncached), before the cached paper is served.
    const sitting = await openTeacherTestSittingForRender(user.id, id);
    initialTest = (await getTestDetailForRender(user.id, id)) as unknown as Test;
    // Per-request window + DB clock, so the timer stops at the window end.
    if (sitting) initialTest = { ...initialTest, ...sitting };
  } catch (error) {
    // A teacher-assigned test outside its window: say when it opens / that it
    // closed, rather than a bare 404. No questions were sent.
    if (isTestWindowError(error)) {
      return <TestWindowNotice code={error.code} startsAt={error.startsAt} endsAt={error.endsAt} />;
    }
    notFound();
  }

  return <TestClient testId={id} initialTest={initialTest} />;
}
