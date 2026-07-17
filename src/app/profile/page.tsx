import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import { getProfileStatsForRender } from '@/server/render-loaders';
import { getFollowCounts } from '@/server/social/social-service';
import { isFeatureEnabled } from '@/lib/feature-flags';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import ProfileClient from './_client';

export default function ProfilePage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <ProfileGate />
    </Suspense>
  );
}

async function ProfileGate() {
  const user = await getServerUser();
  if (!user) redirect('/');

  let initialProfileStats: Awaited<ReturnType<typeof getProfileStatsForRender>> | null = null;
  try {
    initialProfileStats = await getProfileStatsForRender(user.id);
  } catch {
    // Profile page can fall back to client fetch.
  }

  const socialEnabled = isFeatureEnabled('studentSocial');
  let followCounts: { followerCount: number; followingCount: number } | null = null;
  if (socialEnabled) {
    followCounts = await getFollowCounts(user.id).catch(() => null);
  }

  return (
    <ProfileClient
      initialProfileStats={initialProfileStats}
      premiumEnabled={isFeatureEnabled('premiumSubscriptions')}
      socialEnabled={socialEnabled}
      followCounts={followCounts}
    />
  );
}
