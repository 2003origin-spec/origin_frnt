-- Rollback for 20260819_ogcode_daily_subject_questions.sql (OGCODE database).
--
-- Drops the per-subject draw ledger and restores ogcode_daily_challenges in its
-- final shape (post-20260801_ogcode_daily_challenge_mode: primary key on
-- (challenge_date, mode)).
--
-- The restored table comes back EMPTY. Its rows were only ever a schedule of
-- past picks — no student progress, attempt or entitlement referenced them — so
-- an empty table simply means the old selector re-picks from today onward, which
-- is exactly what it does after any gap.

DROP TABLE IF EXISTS ogcode_daily_subject_questions;

CREATE TABLE IF NOT EXISTS ogcode_daily_challenges (
  challenge_date DATE NOT NULL,
  question_id    TEXT NOT NULL,
  was_curated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode           TEXT NOT NULL DEFAULT 'pcmb',
  PRIMARY KEY (challenge_date, mode)
);

CREATE INDEX IF NOT EXISTS ogcode_daily_challenges_question_idx
  ON ogcode_daily_challenges (question_id);

DO $$ BEGIN
  ALTER TABLE ogcode_daily_challenges ADD CONSTRAINT ogcode_daily_challenges_mode_check
    CHECK (mode IN ('jee','neet','pcmb'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
