import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getServerFrontendUser } from '@/lib/auth-server';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import CollegeFinder from '@/sections/CollegeFinder/CollegeFinder';
import CollegeFinderPreview from '@/sections/CollegeFinder/Preview';

// College finder (V1/PERCENTILE_PREDICTOR_PLAN.md §11.4). Signed-in users get
// the tool; visitors a short preview with "Create a free account / Log in"
// (Q9). 404 unless both rankPredictor and collegeCounselling are on (runtime
// check, so the kill switch hides it too). Not indexed (robots disallows it).
export const dynamic = 'force-dynamic';

async function enabled(): Promise<boolean> {
  const [predictor, counselling] = await Promise.all([isFeatureEnabledRuntime('rankPredictor'), isFeatureEnabledRuntime('collegeCounselling')]);
  return predictor && counselling;
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await enabled())) return {};
  return {
    title: 'College finder: JoSAA, CSAB and NEET colleges for your rank | Origin',
    description: 'See which IIT, NIT, IIIT, GFTI and medical college seats your rank would have got in past years, round by round.',
    robots: { index: false, follow: true },
  };
}

export default async function CollegeFinderPage() {
  if (!(await enabled())) notFound();
  const user = await getServerFrontendUser();
  if (!user) return <CollegeFinderPreview />;
  return <CollegeFinder initialExam={user.studyMode === 'jee' ? 'jee' : 'neet'} />;
}
