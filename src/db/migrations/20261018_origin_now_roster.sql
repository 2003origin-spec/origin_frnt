-- 20261018_origin_now_roster: weekly roster — the evenings each solver says
-- they will cover, per subject (pilot readiness item 3, decision B82).
-- New table only; idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

CREATE TABLE IF NOT EXISTS now.roster (
  helper_id TEXT NOT NULL REFERENCES now.helpers(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (helper_id, day, subject)
);
CREATE INDEX IF NOT EXISTS idx_roster_day ON now.roster(day, subject);

INSERT INTO app.migrations (id, name) VALUES ('20261018_origin_now_roster', 'origin now: weekly solver roster')
  ON CONFLICT (id) DO NOTHING;
