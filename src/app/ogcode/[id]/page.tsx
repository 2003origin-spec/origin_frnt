import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { renderStudyModeKey } from '@/server/study-scope';
import { getServerUser } from '@/lib/auth-server';
import { getPracticeQuestionDetailForRender } from '@/server/render-loaders';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import OutOfModeInterstitial from '@/components/study-mode/OutOfModeInterstitial';
import type { PracticeQuestion } from '@/types';
import OGCodeClient from './_client';

export default function OGCodeWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <OGCodeContent params={params} />
    </Suspense>
  );
}

/**
 * Recognises the Study Mode refusal thrown by getPracticeQuestionDetail.
 * Matches on `code` when it survives the unstable_cache boundary and on
 * status + message otherwise, so the interstitial never degrades into the
 * generic "couldn't load" state.
 */
function isOutOfModeError(error: unknown): boolean {
  const err = error as { code?: string; status?: number; message?: string } | null;
  if (!err) return false;
  if (err.code === 'out_of_study_mode') return true;
  return err.status === 403 && /study mode/i.test(err.message ?? '');
}

async function OGCodeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialQuestion: PracticeQuestion | null = null;
  try {
    initialQuestion = (await getPracticeQuestionDetailForRender(await renderStudyModeKey(user), user.id, id)) as unknown as PracticeQuestion;
  } catch (error) {
    // Out-of-mode is an explainable state, not a failure: show the switch prompt
    // instead of letting the client retry into the same 403.
    if (isOutOfModeError(error)) {
      return <OutOfModeInterstitial />;
    }
    // Anything else: the workspace will do a client fetch as a fallback.
  }

  return <OGCodeClient questionId={id} initialQuestion={initialQuestion} />;
}
