import { NextResponse } from 'next/server';

import { getUserPostgresPool, isUserPostgresConfigured } from '@/server/user-postgres';
import { generalLimiter, checkRateLimit } from '@/lib/rate-limit';
import { getActiveScreens } from '@/server/presence';

/** Vercel-resolved client IP (it overwrites x-forwarded-for; not spoofable). */
function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'anonymous';
}

/**
 * "solving right now" = number of active app screens worldwide. Every signed-in
 * app screen heartbeats into the global presence set (see src/server/presence.ts),
 * so this counts open screens (tabs/devices), not just OGCode.
 */
async function activeNow(): Promise<number> {
  return getActiveScreens();
}

/** Real "doubts solved today" — doubt sessions with activity since UTC midnight. */
async function doubtsToday(): Promise<number> {
  if (!isUserPostgresConfigured()) return 0;
  const pool = getUserPostgresPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM app.doubt_sessions
        WHERE updated_at >= date_trunc('day', NOW())`,
    );
    return Number(res.rows[0]?.count ?? 0);
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

  const [active, doubts, streaks] = await Promise.all([activeNow(), doubtsToday(), streaksActive()]);
  return NextResponse.json(
    { activeNow: active, doubtsToday: doubts, streaksActive: streaks },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
