/**
 * OGCode live-presence daily peak (admin analytics §12 add-on).
 *
 * Redis presence knows only the *current* live count and ages out, so the
 * all-time / weekly "highest live" can't be derived from it. This persists one
 * row per UTC day with that day's peak concurrent students, upserted from the
 * presence heartbeat via GREATEST(existing, current). OGCODE pool, co-located
 * with the other ogcode_* tables. Best-effort; never blocks a heartbeat.
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodePresencePeakSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_presence_daily_peak (
    day  DATE PRIMARY KEY,
    peak INTEGER NOT NULL DEFAULT 0
  );
`;

export function isOgcodePresencePeakAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function ensurePeakSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodePresencePeakSchemaReady) {
    globalThis.__originOgcodePresencePeakSchemaReady = pool
      .query(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originOgcodePresencePeakSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originOgcodePresencePeakSchemaReady;
}

// Per-process throttle so a busy heartbeat stream doesn't hammer Postgres: at
// most one peak write per interval unless a genuinely higher count is seen.
let lastPeakWriteMs = 0;
let lastPeakWriteValue = 0;
const PEAK_WRITE_THROTTLE_MS = 20_000;

/** Upsert today's peak with `current` if it's a new high (throttled). No-op on 0. */
export async function recordOgcodeLivePeak(current: number): Promise<void> {
  if (current <= 0) return;
  const now = Date.now();
  if (now - lastPeakWriteMs < PEAK_WRITE_THROTTLE_MS && current <= lastPeakWriteValue) return;
  lastPeakWriteMs = now;
  lastPeakWriteValue = current;
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  try {
    await ensurePeakSchema();
    await pool.query(
      `INSERT INTO ogcode_presence_daily_peak (day, peak)
       VALUES (CURRENT_DATE, $1)
       ON CONFLICT (day) DO UPDATE SET peak = GREATEST(ogcode_presence_daily_peak.peak, EXCLUDED.peak)`,
      [current],
    );
  } catch {
    // Best-effort telemetry; never block the heartbeat.
  }
}

export type OgcodePeakStats = {
  allTime: number;
  today: number;
  thisWeek: number;
};

/** Peak concurrent students: all-time, today, and this (ISO) week. */
export async function getOgcodeLivePeakStats(): Promise<OgcodePeakStats> {
  const empty: OgcodePeakStats = { allTime: 0, today: 0, thisWeek: 0 };
  const pool = getOgcodePostgresPool();
  if (!pool) return empty;
  try {
    await ensurePeakSchema();
    const res = await pool.query<{ all_time: string; today: string; this_week: string }>(
      `SELECT
         COALESCE(MAX(peak), 0) AS all_time,
         COALESCE(MAX(peak) FILTER (WHERE day = CURRENT_DATE), 0) AS today,
         COALESCE(MAX(peak) FILTER (WHERE day >= date_trunc('week', CURRENT_DATE)), 0) AS this_week
       FROM ogcode_presence_daily_peak`,
    );
    const row = res.rows[0];
    return {
      allTime: Number(row?.all_time ?? 0),
      today: Number(row?.today ?? 0),
      thisWeek: Number(row?.this_week ?? 0),
    };
  } catch {
    return empty;
  }
}
