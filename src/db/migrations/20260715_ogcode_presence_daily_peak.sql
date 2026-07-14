-- OGCode live-presence daily peak (admin analytics). One row per UTC day with
-- that day's peak concurrent students, upserted from the presence heartbeat.
-- OGCODE pool. Mirrored by the runtime-ensure in src/server/ogcode-presence-peak.ts.
-- Idempotent + additive; safe to re-run.

CREATE TABLE IF NOT EXISTS ogcode_presence_daily_peak (
  day  DATE PRIMARY KEY,
  peak INTEGER NOT NULL DEFAULT 0
);
