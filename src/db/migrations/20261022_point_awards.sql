-- 20261022_point_awards: durable "already rewarded" claims for prestige points
-- (bug-fix G6 unlimited test/DPP resubmits + N4 book-save / pomodoro farming).
-- USER database. Additive + idempotent. Mirrored at runtime by
-- ensurePointAwardsSchema() (src/server/point-awards.ts).
--
-- One row per (user, award_key). A submit/save/pomodoro claims its key with
-- INSERT ... ON CONFLICT DO NOTHING RETURNING before awardPoints runs; no row
-- returned ⇒ no points. award_key shapes:
--   'test:<testId>'                 first completed attempt of a test
--   'dpp:<dppId>'                   first completed attempt of a DPP
--   '<activityType>:<referenceId>'  activity awards (study_corner:<bookId>,
--                                   pomodoro:<sessionId>, ...)
--
-- After applying on prod, run scripts/backfill-point-awards.ts (dry-run first)
-- to seed claims for historical first attempts and to list farmed awards.

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.point_awards (
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  award_key TEXT NOT NULL,
  points NUMERIC NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, award_key)
);

INSERT INTO app.migrations (id, name)
VALUES ('20261022_point_awards', 'point awards: once-per-reference claim table')
  ON CONFLICT (id) DO NOTHING;
