// Server Component — auth check + redirect logic live in _client.tsx and proxy.ts
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getIncidentStateNonBlocking } from '@/server/incidents';
import { parseAppVersionFromUserAgent } from '@/native/is-native-app';
import HomeClient from './_client';

const HOME_TITLE = 'ORIGIN AI - Best Preparation Platform for JEE/NEET';
const HOME_DESCRIPTION_WITH_PREDICTOR =
  'AI-powered learning platform for JEE, NEET and Foundation: personalised guidance, infinite practice, 24/7 AI mentoring, and a free NEET and JEE rank predictor.';
const HOME_DESCRIPTION_WITH_COLLEGES =
  'AI-powered learning platform for JEE, NEET and Foundation: personalised guidance, infinite practice, 24/7 AI mentoring, and a free NEET and JEE rank predictor with a JoSAA and NEET college finder.';

async function predictorFlags(): Promise<{ predictor: boolean; colleges: boolean }> {
  const { flagOverrides } = await getIncidentStateNonBlocking();
  return {
    predictor: flagOverrides.get('rankPredictor') ?? isFeatureEnabled('rankPredictor'),
    colleges: flagOverrides.get('collegeCounselling') ?? isFeatureEnabled('collegeCounselling'),
  };
}

// The root layout's metadata stays the default. While the Rank Predictor is on,
// the home description also names it (SEO_APP_DOWNLOAD_NOTES.md); flag off →
// nothing about it. openGraph/twitter are replaced whole by Next, so they are
// restated here with the root layout's values.
export async function generateMetadata(): Promise<Metadata> {
  const flags = await predictorFlags();
  if (!flags.predictor) return {};
  const description = flags.colleges ? HOME_DESCRIPTION_WITH_COLLEGES : HOME_DESCRIPTION_WITH_PREDICTOR;
  return {
    description,
    openGraph: {
      title: HOME_TITLE,
      description,
      url: '/',
      siteName: 'ORIGIN AI',
      images: [{ url: '/origin-new.jpg', alt: 'ORIGIN AI - Best Prep Platform' }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: HOME_TITLE, description, images: ['/origin-new.jpg'] },
  };
}

export default async function HomePage() {
  // Rank Predictor landing section (plan §9.2): env flag plus the /admin/incidents
  // kill switch, read on the server and passed down. Uses the middleware's
  // stale-while-revalidate snapshot so the busiest page never waits on Redis
  // once warm (never rejects; a cold instance waits at most ~0.7 s). `/` is
  // already rendered per request (the root layout reads the session cookie), so
  // this changes no caching.
  const rankPredictorEnabled = (await predictorFlags()).predictor;
  // Inside our Android app shell (UA marker OriginApp/…): no "get the app" section or pill,
  // decided on the server so nothing renders and then disappears.
  const inAppShell = parseAppVersionFromUserAgent((await headers()).get('user-agent')) !== null;
  return <HomeClient rankPredictorEnabled={rankPredictorEnabled} inAppShell={inAppShell} />;
}
