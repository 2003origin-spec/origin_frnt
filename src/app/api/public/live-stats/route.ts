import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

import { getUserPostgresPool, isUserPostgresConfigured } from '@/server/user-postgres';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : null;

/** presence:active heartbeats count as "active" for 5 minutes. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

/** Real active-now from the shared presence set (fed by OGCode heartbeats). */
async function activeNow(): Promise<number> {
  if (!redis) return 0;
  try {
    return await redis.zcount('presence:active', Date.now() - ACTIVE_WINDOW_MS, '+inf');
  } catch {
    return 0;
  }
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

export async function GET() {
  const [active, doubts, streaks] = await Promise.all([activeNow(), doubtsToday(), streaksActive()]);
  return NextResponse.json(
    { activeNow: active, doubtsToday: doubts, streaksActive: streaks },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
