-- 20261022_attempt_starts: server-recorded start of a self test / DPP attempt
-- (G7 in V1/docs/bug-fixes/03-grading-points.md). Submit computes the time
-- taken as clamp(now - started_at, 0, duration) instead of trusting the
-- client's timeTaken. At most one OPEN row per (user, kind, assessment).
-- OGCODE pool (next to analytics.*). New table only; idempotent.
-- Mirrored at runtime by ensureAttemptStartsSchema (src/server/attempt-starts.ts).

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.attempt_starts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('test', 'dpp')),
  assessment_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_result_id TEXT,
  consumed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_starts_open
  ON analytics.attempt_starts (user_id, kind, assessment_id)
  WHERE consumed_result_id IS NULL;

INSERT INTO app.migrations (id, name) VALUES ('20261022_attempt_starts', 'analytics: server-recorded attempt starts (G7)')
  ON CONFLICT (id) DO NOTHING;
