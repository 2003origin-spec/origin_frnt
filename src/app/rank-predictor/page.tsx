import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getServerFrontendUser } from '@/lib/auth-server';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import { isExamPresetId } from '@/lib/exam-blueprints';
import type { RankPredictorExam } from '@/lib/rank-predictor/types';
import { rankPredictorShiftOptions } from '@/server/rank-predictor/data';
import RankPredictor from '@/sections/RankPredictor/RankPredictor';

// Rank Predictor (V1/PERCENTILE_PREDICTOR_PLAN.md §9.1). Stage 2: signed-in
// users only (authenticated app prefix); Stage 3 opens it to visitors, adds the
// sitemap entry and drops the login redirect. 404 while the flag is off.
export const dynamic = 'force-dynamic';

const METADATA: Metadata = {
  title: 'NEET & JEE Rank Predictor 2027 — Free | Origin',
  description:
    'Free NEET, JEE Main and JEE Advanced rank predictor: enter your marks per subject and see your All India rank, category rank and state rank range, from past years’ official results.',
};

// Flag off: no title or description either, so nothing about the page leaks.
export async function generateMetadata(): Promise<Metadata> {
  return (await isFeatureEnabledRuntime('rankPredictor')) ? METADATA : {};
}

type PageProps = { searchParams?: Promise<{ attempt?: string | string[] }> };

const RESULT_ID = /^[A-Za-z0-9_-]{1,80}$/;

export default async function RankPredictorPage({ searchParams }: PageProps) {
  // Runtime check: a kill switch thrown in /admin/incidents hides the page too.
  if (!(await isFeatureEnabledRuntime('rankPredictor'))) notFound();
  const user = await getServerFrontendUser();
  if (!user) redirect('/auth?next=/rank-predictor');

  const query = searchParams ? await searchParams : {};
  const rawAttempt = Array.isArray(query.attempt) ? query.attempt[0] : query.attempt;
  const isStudent = user.role === 'student';
  const attemptId = isStudent && rawAttempt && RESULT_ID.test(rawAttempt) ? rawAttempt : null;

  // Pre-select the exam from the student's study mode (NEET mode → NEET, JEE → JEE Main).
  const mode = user.studyMode ?? null;
  const initialExam: RankPredictorExam = mode === 'jee' ? 'jee-main' : 'neet';

  return (
    <RankPredictor
      initialExam={isExamPresetId(initialExam) ? initialExam : 'neet'}
      canFillFromTests={isStudent}
      shiftOptions={rankPredictorShiftOptions()}
      initialAttemptId={attemptId}
    />
  );
}
