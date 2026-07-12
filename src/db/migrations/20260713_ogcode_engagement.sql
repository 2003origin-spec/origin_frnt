-- OGCode Engagement Features (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §9-13).
-- All on the OGCODE pool, co-located with ogcode_questions. Plain TEXT user_id,
-- no cross-pool FK (origin_users lives on the USER pool — same physical Neon
-- cluster in prod, separate pools in code, same as ogcode_question_progress).
--
-- Idempotent: safe to re-run. Purely additive — no existing column/row touched.

-- ── §9 Global stats: avg time-to-correct + first-attempt counters ──
ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS correct_time_sum    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS correct_time_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS first_attempt_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS first_attempt_correct INTEGER NOT NULL DEFAULT 0;

-- §9 completion-time histogram. Narrow table (not a JSONB blob) so each bucket
-- increment is an atomic upsert with no read-modify-write lost-update race.
-- bucket_index = floor(tt / 5), capped at 120 (i.e. 600s+ overflow bucket).
CREATE TABLE IF NOT EXISTS ogcode_question_time_buckets (
  question_id  TEXT NOT NULL,
  bucket_index SMALLINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (question_id, bucket_index)
);

-- ── §10 Liked Questions (upvote-only; public count) ──
CREATE TABLE IF NOT EXISTS ogcode_question_likes (
  user_id     TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS ogcode_question_likes_question_idx ON ogcode_question_likes (question_id);

-- ── §11 Report Question (store-only; one report per student per question) ──
CREATE TABLE IF NOT EXISTS ogcode_question_reports (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS ogcode_question_reports_status_idx ON ogcode_question_reports (status);

-- ── §13 Friend Challenge (mutual-follow; 1 pending per sender/recipient/question) ──
CREATE TABLE IF NOT EXISTS ogcode_friend_challenges (
  id           TEXT PRIMARY KEY,
  question_id  TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | completed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempted_at TIMESTAMPTZ,
  result_score NUMERIC,
  result_time  INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS ogcode_friend_challenges_pending_uniq
  ON ogcode_friend_challenges (from_user_id, to_user_id, question_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ogcode_friend_challenges_to_idx ON ogcode_friend_challenges (to_user_id, status);
CREATE INDEX IF NOT EXISTS ogcode_friend_challenges_from_idx ON ogcode_friend_challenges (from_user_id, status);
