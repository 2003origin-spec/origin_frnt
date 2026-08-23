// Server Component — router callbacks live in _client.tsx
import { isFeatureEnabled } from '@/lib/feature-flags';
import ExploreClient from './_client';

export default function ExplorePage() {
  return (
    <ExploreClient
      socialEnabled={isFeatureEnabled('studentSocial')}
      connectEnabled={isFeatureEnabled('teacherConnect')}
      contestEnabled={isFeatureEnabled('contest')}
    />
  );
}
