import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/seo/JsonLd';
import { getServerFrontendUser } from '@/lib/auth-server';
import {
  breadcrumbJsonLd,
  COLLEGE_FINDER_DESCRIPTION,
  COLLEGE_FINDER_FAQ,
  COLLEGE_FINDER_PATH,
  COLLEGE_FINDER_TITLE,
  faqPageJsonLd,
  RANK_PREDICTOR_PATH,
  SEO_IMAGE,
  webApplicationJsonLd,
} from '@/lib/seo/rank-predictor-seo';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import CollegeFinder from '@/sections/CollegeFinder/CollegeFinder';
import CollegeFinderPreview from '@/sections/CollegeFinder/Preview';

// College finder (V1/PERCENTILE_PREDICTOR_PLAN.md §11.4). Signed-in users get
// the tool; visitors (and search bots) a public page: what it does, how it
// works, a FAQ and "Create a free account / Log in" (Q9). The search API stays
// signed-in only. 404 unless both rankPredictor and collegeCounselling are on
// (runtime check, so the kill switch hides it, its metadata and JSON-LD too).
export const dynamic = 'force-dynamic';

async function enabled(): Promise<boolean> {
  const [predictor, counselling] = await Promise.all([isFeatureEnabledRuntime('rankPredictor'), isFeatureEnabledRuntime('collegeCounselling')]);
  return predictor && counselling;
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await enabled())) return {};
  return {
    title: COLLEGE_FINDER_TITLE,
    description: COLLEGE_FINDER_DESCRIPTION,
    alternates: { canonical: COLLEGE_FINDER_PATH },
    openGraph: {
      title: COLLEGE_FINDER_TITLE,
      description: COLLEGE_FINDER_DESCRIPTION,
      url: COLLEGE_FINDER_PATH,
      type: 'website',
      siteName: 'O3 Origin',
      locale: 'en_IN',
      images: [SEO_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: COLLEGE_FINDER_TITLE, description: COLLEGE_FINDER_DESCRIPTION, images: [SEO_IMAGE.url] },
  };
}

export default async function CollegeFinderPage() {
  if (!(await enabled())) notFound();
  const user = await getServerFrontendUser();
  if (user) return <CollegeFinder initialExam={user.studyMode === 'jee' ? 'jee' : 'neet'} />;

  const siteUrl = getCanonicalSiteUrl();
  return (
    <>
      <JsonLd
        data={[
          webApplicationJsonLd({ siteUrl, path: COLLEGE_FINDER_PATH, name: 'Origin College Finder', description: COLLEGE_FINDER_DESCRIPTION }),
          breadcrumbJsonLd(siteUrl, [
            { name: 'Home', path: '/' },
            { name: 'Rank Predictor', path: RANK_PREDICTOR_PATH },
            { name: 'College finder', path: COLLEGE_FINDER_PATH },
          ]),
          // Only on the logged-out page, where the same questions are visible.
          faqPageJsonLd(COLLEGE_FINDER_FAQ),
        ]}
      />
      <CollegeFinderPreview />
    </>
  );
}
