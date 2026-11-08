-- 20261019_origin_now_web_push: browser push subscriptions so solvers get
-- an alert for each offer while the shift screen is in the background
-- (decision B85). New table only; idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

CREATE TABLE IF NOT EXISTS now.push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  user_agent TEXT,
  failures INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON now.push_subscriptions(user_id);

INSERT INTO app.migrations (id, name) VALUES ('20261019_origin_now_web_push', 'origin now: browser push subscriptions for solver offers')
  ON CONFLICT (id) DO NOTHING;
