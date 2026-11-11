// Server Component — auth check + redirect logic live in _client.tsx and proxy.ts
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getIncidentStateNonBlocking } from '@/server/incidents';
import HomeClient from './_client';

export default async function HomePage() {
  // Rank Predictor landing section (plan §9.2): env flag plus the /admin/incidents
  // kill switch, read on the server and passed down. Uses the middleware's
  // stale-while-revalidate snapshot so the busiest page never waits on Redis
  // once warm (never rejects; a cold instance waits at most ~0.7 s). `/` is
  // already rendered per request (the root layout reads the session cookie), so
  // this changes no caching.
  const { flagOverrides } = await getIncidentStateNonBlocking();
  const rankPredictorEnabled = flagOverrides.get('rankPredictor') ?? isFeatureEnabled('rankPredictor');
  return <HomeClient rankPredictorEnabled={rankPredictorEnabled} />;
}
