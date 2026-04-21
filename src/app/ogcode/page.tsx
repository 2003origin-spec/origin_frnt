import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { readStore } from '@/server/store';
import { listOgcodeQuestions } from '@/server/assessments';
import OGCodeClient from './_client';
import type { PracticeQuestion } from '@/types';

export default async function OGCodePage() {
  const serverUser = await getServerUser();
  if (!serverUser) redirect('/auth?next=/ogcode');

  let initialQuestions: PracticeQuestion[] = [];
  try {
    const store = readStore();
    // Fetch all questions with no filters — the client-side filter UI starts at "All"
    initialQuestions = (await listOgcodeQuestions(store, serverUser, {})) as unknown as PracticeQuestion[];
  } catch {
    // OGCodeList will fetch questions client-side on mount
  }

  return <OGCodeClient initialQuestions={initialQuestions} />;
}
