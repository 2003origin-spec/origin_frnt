-- OGCode Scoring V2 (V1/OGCODE_SCORING_ALGORITHM.md, Phase 1a).
-- Per-(student, question) attempt/reveal progress backing the CS_core scoring
-- engine: TA (total_attempts) with atomic increments, the Attempted flag, and
-- which reveal decay (hint bs/2 vs answer bs=0) applies at grading time.
--
-- Applies to the OGCODE pool (OGCODE_DATABASE_URL), co-located with
-- ogcode_questions so list badges/filters can JOIN. Plain TEXT user_id, no FK:
-- origin_users lives on the USER pool (same physical Neon cluster in prod,
-- separate pools in code — same reason ogcode_daily_challenges has no user FK).

CREATE TABLE IF NOT EXISTS ogcode_question_progress (
  user_id           TEXT NOT NULL,
  question_id       TEXT NOT NULL,
  total_attempts    INTEGER NOT NULL DEFAULT 0,
  attempted         BOOLEAN NOT NULL DEFAULT FALSE,
  hint_revealed     BOOLEAN NOT NULL DEFAULT FALSE,
  answer_revealed   BOOLEAN NOT NULL DEFAULT FALSE,
  best_score        NUMERIC,
  first_terminal_at TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS ogcode_question_progress_question_idx
  ON ogcode_question_progress (question_id);
