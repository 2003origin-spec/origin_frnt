-- Recurring contest schedules (auto-scheduling). A template that a cron uses to
-- spin up + auto-publish the next contest every `cadence_days`, so a weekly
-- contest runs set-and-forget instead of being hand-built each week.
-- Idempotent; additive.

CREATE TABLE IF NOT EXISTS contest.schedules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,                 -- base name; occurrences get " #N"
  subjects         JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics           JSONB NOT NULL DEFAULT '{}'::jsonb,
  selections       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{subject,count,topics?}]
  duration_minutes INTEGER NOT NULL,
  reg_lead_days    INTEGER NOT NULL DEFAULT 5,
  cadence_days     INTEGER NOT NULL DEFAULT 7,
  scoring_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ogcode_reward    INTEGER NOT NULL DEFAULT 0,
  display_tz       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  next_start_at    TIMESTAMPTZ NOT NULL,          -- when the NEXT occurrence starts (UTC)
  run_count        INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  last_contest_id  TEXT,
  created_by       TEXT REFERENCES origin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contest_schedules_due
  ON contest.schedules(active, next_start_at);
