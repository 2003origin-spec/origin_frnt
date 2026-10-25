import { NextResponse } from 'next/server';

import { generalLimiter, checkRateLimit } from '@/lib/rate-limit';
import { getPublicLiveStats } from '@/server/public-live-stats';
import { recordSiteVisit } from '@/server/site-stats';

/** Vercel-resolved client IP (it overwrites x-forwarded-for; not spoofable). */
function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'anonymous';
}

export async function GET(request: Request) {
  // Unauthenticated + polled every 15 s by every landing tab. The aggregates
  // are memoised for 30 s (Redis, or in-process without it) so polls never run
  // the full-table scans themselves; the per-IP limiter still caps floods.
  const limited = await checkRateLimit(generalLimiter, `pub-livestats:${clientIp(request)}`, {
    honorIncidentMode: false,
  });
  if (limited) return limited;

  // The landing page tags only its very first poll with ?first=1, so we count
  // one visit per page load — not once per 15s poll. That request must reach
  // the function (to INCR), so it is never CDN-cached; the plain polls are.
  const firstLoad = new URL(request.url).searchParams.get('first') === '1';
  if (firstLoad) {
    await recordSiteVisit();
  }

  const stats = await getPublicLiveStats();
  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': firstLoad ? 'private, no-store' : 'public, s-maxage=15, stale-while-revalidate=15',
    },
  });
}
