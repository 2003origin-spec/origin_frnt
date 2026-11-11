import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getServerFrontendUser } from '@/lib/auth-server';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import { isExamPresetId } from '@/lib/exam-blueprints';
import type { RankPredictorExam } from '@/lib/rank-predictor/types';
import PredictorPage, { predictorMetadata } from '@/sections/RankPredictor/PredictorPage';

// Rank Predictor (V1/PERCENTILE_PREDICTOR_PLAN.md §9.1). Public: visitors get
// 2 free checks a day (enforced by the API, plan §8), signed-in users unlimited.
// 404 while the flag is off (runtime check, so the kill switch hides it too).
// Exam entry pages live at /rank-predictor/[exam] (SEO_APP_DOWNLOAD_NOTES.md).
export const dynamic = 'force-dynamic';

// Flag off: no title, description or JSON-LD either, so nothing about the page leaks.
export async function generateMetadata(): Promise<Metadata> {
  return (await isFeatureEnabledRuntime('rankPredictor')) ? predictorMetadata(null) : {};
}

type PageProps = { searchParams?: Promise<{ attempt?: string | string[] }> };

const RESULT_ID = /^[A-Za-z0-9_-]{1,80}$/;

export default async function RankPredictorPage({ searchParams }: PageProps) {
  // Runtime check: a kill switch thrown in /admin/incidents hides the page too.
  if (!(await isFeatureEnabledRuntime('rankPredictor'))) notFound();
  const user = await getServerFrontendUser();

  const query = searchParams ? await searchParams : {};
  const rawAttempt = Array.isArray(query.attempt) ? query.attempt[0] : query.attempt;
  const isStudent = user?.role === 'student';
  const attemptId = isStudent && rawAttempt && RESULT_ID.test(rawAttempt) ? rawAttempt : null;

  // Pre-select the exam from the student's study mode (NEET mode → NEET, JEE → JEE Main).
  const mode = user?.studyMode ?? null;
  const initialExam: RankPredictorExam = mode === 'jee' ? 'jee-main' : 'neet';

  const collegesEnabled = await isFeatureEnabledRuntime('collegeCounselling');

  return (
    <PredictorPage
      examPage={null}
      initialExam={isExamPresetId(initialExam) ? initialExam : 'neet'}
      initialAttemptId={attemptId}
      collegesEnabled={collegesEnabled}
    />
  );
}
