import { NextResponse } from 'next/server';

import { getUserPostgresPool, isUserPostgresConfigured } from '@/server/user-postgres';
import { getOgcodePostgresPool, isOgcodePostgresConfigured } from '@/server/postgres';
import { generalLimiter, checkRateLimit } from '@/lib/rate-limit';
import { getSiteVisits, recordSiteVisit } from '@/server/site-stats';

/** Vercel-resolved client IP (it overwrites x-forwarded-for; not spoofable). */
function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'anonymous';
}

/** All-time "aspirants & counting" — cumulative landing-page visits. */
async function visits(): Promise<number> {
  return getSiteVisits();
}

/**
 * All-time "questions conquered" — total correct first-attempts across the whole
 * OGCode question bank. `first_attempt_correct` is a per-question aggregate
 * maintained by the engagement tracker, so SUM() is the real platform-wide total.
 */
async function questionsConquered(): Promise<number> {
  if (!isOgcodePostgresConfigured()) return 0;
  const pool = getOgcodePostgresPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ total: number | string }>(
      `SELECT COALESCE(SUM(first_attempt_correct), 0) AS total FROM ogcode_questions`,
    );
    return Number(res.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

/** Real active-streak count — users whose streak is alive (studied today/yesterday). */
async function streaksActive(): Promise<number> {
  if (!isUserPostgresConfigured()) return 0;
  const pool = getUserPostgresPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM app.streaks
        WHERE COALESCE((data->>'currentStreak')::int, 0) >= 1
          AND (data->>'lastStudyDate') IS NOT NULL
          AND (data->>'lastStudyDate')::date >= (CURRENT_DATE - INTERVAL '1 day')`,
    );
    return Number(res.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  // Unauthenticated + hits Redis and two Postgres COUNTs — cap per-IP floods
  // (each IP still gets a generous budget so the landing page can poll freely).
  const limited = await checkRateLimit(generalLimiter, `pub-livestats:${clientIp(request)}`, {
    honorIncidentMode: false,
  });
  if (limited) return limited;

  // The landing page tags only its very first poll with ?first=1, so we count
  // one visit per page load — not once per 15s poll.
  if (new URL(request.url).searchParams.get('first') === '1') {
    await recordSiteVisit();
  }

  const [siteVisits, questionsSolved, streaks] = await Promise.all([
    visits(),
    questionsConquered(),
    streaksActive(),
  ]);
  return NextResponse.json(
    { visits: siteVisits, questionsSolved, streaksActive: streaks },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
