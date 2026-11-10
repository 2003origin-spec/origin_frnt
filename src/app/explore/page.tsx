// Server Component — router callbacks live in _client.tsx
import { isFeatureEnabled } from '@/lib/feature-flags';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import ExploreClient from './_client';

export default async function ExplorePage() {
  // Runtime check so an /admin/incidents kill switch also hides the card.
  const rankPredictorEnabled = await isFeatureEnabledRuntime('rankPredictor');
  return (
    <ExploreClient
      socialEnabled={isFeatureEnabled('studentSocial')}
      connectEnabled={isFeatureEnabled('teacherConnect')}
      contestEnabled={isFeatureEnabled('contest')}
      notesEnabled={isFeatureEnabled('notes')}
      rankPredictorEnabled={rankPredictorEnabled}
    />
  );
}
