-- Per-user daily AI usage history (tokens + voice minutes).
-- origin_users.tokens_used_today / voice_minutes_used_today remain the live
-- quota counters; this table keeps one row per user per UTC day so history
-- survives the daily reset.

BEGIN;

CREATE TABLE IF NOT EXISTS origin_user_daily_usage (
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  voice_minutes_used DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_origin_user_daily_usage_date
  ON origin_user_daily_usage (usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_origin_user_daily_usage_user_date
  ON origin_user_daily_usage (user_id, usage_date DESC);

-- Seed today's counters from the live quota columns (best-effort).
INSERT INTO origin_user_daily_usage (user_id, usage_date, tokens_used, voice_minutes_used, updated_at)
SELECT
  id,
  CURRENT_DATE,
  COALESCE(tokens_used_today, 0),
  COALESCE(voice_minutes_used_today, 0),
  NOW()
FROM origin_users
WHERE COALESCE(tokens_used_today, 0) > 0
   OR COALESCE(voice_minutes_used_today, 0) > 0
ON CONFLICT (user_id, usage_date) DO UPDATE SET
  tokens_used = GREATEST(origin_user_daily_usage.tokens_used, EXCLUDED.tokens_used),
  voice_minutes_used = GREATEST(origin_user_daily_usage.voice_minutes_used, EXCLUDED.voice_minutes_used),
  updated_at = NOW();

INSERT INTO app.migrations (id, name)
VALUES (
  '20260730_user_daily_usage',
  'per-user daily tokens + voice minutes history'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
