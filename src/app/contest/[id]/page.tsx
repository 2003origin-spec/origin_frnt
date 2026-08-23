import { notFound, redirect } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getContest } from '@/server/contest/contest-admin-service';

/**
 * Bare /contest/[id] hub — the landing target for every contest notification
 * (confirmation / T-24h / T-10m / "results are out"). Redirects to the RIGHT
 * sub-page based on the contest's current state at click time, so one link works
 * for every reminder kind:
 *   result_published/archived → /result   (results are out)
 *   live now                  → /play      (enter the contest)
 *   otherwise (upcoming/draft)→ /practice  (warm up; itself gates on registration)
 */
export default async function ContestHubPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('contest')) notFound();
  const { id } = await params;

  let contest: Awaited<ReturnType<typeof getContest>> = null;
  try {
    contest = await getContest(id);
  } catch {
    contest = null;
  }
  if (!contest) notFound();

  // Ended or published → the result page (shows "being finalized" until publish).
  if (
    contest.status === 'result_published' ||
    contest.status === 'archived' ||
    contest.status === 'result_processing'
  ) {
    redirect(`/contest/${id}/result`);
  }

  const now = Date.now();
  const start = contest.startAt ? new Date(contest.startAt).getTime() : null;
  const end = contest.endAt ? new Date(contest.endAt).getTime() : null;
  if (contest.status === 'scheduled' && start != null && end != null && now >= start && now < end) {
    redirect(`/contest/${id}/play`);
  }

  // Upcoming (or draft/processing) → the practice hub, which gates on registration.
  redirect(`/contest/${id}/practice`);
}
