import { unstable_cache } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  getPopularStudents,
  loadPopularBoards,
  type PopularStudents,
} from '@/server/social/social-service';
import SocialDashboard from '@/components/social/SocialDashboard';

// The three boards are viewer-agnostic aggregates over the whole platform, so
// one cached copy (5 min) serves every viewer; getPopularStudents then drops the
// viewer and annotates follow state live. Own tag (not "leaderboard", which is
// revalidated on every practice submit and would keep this cache cold).
const loadPopularBoardsCached = unstable_cache(
  async (perTab: number) => loadPopularBoards(perTab),
  ['social:popular'],
  { revalidate: 300, tags: ['social-popular'] },
);

export default async function SocialPage() {
  if (!isFeatureEnabled('studentSocial')) notFound();

  const viewer = await getServerUser();
  if (!viewer) redirect('/');

  let popular: PopularStudents = { followed: [], ranked: [], active: [] };
  try {
    popular = await getPopularStudents(viewer.id, 24, loadPopularBoardsCached);
  } catch {
    popular = { followed: [], ranked: [], active: [] };
  }

  return (
    <SocialDashboard
      data={popular}
      viewerName={viewer.name}
      viewerUsername={viewer.username ?? null}
    />
  );
}
