-- Origin Weekly Contest + ORBIT — foundation schema (Phase 0).
-- Target database: USER (contest tables FK to origin_users; contest_questions is
-- a self-contained frozen snapshot, so there is NO cross-DB FK to ogcode).
-- Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md §2
--
-- Fully additive and idempotent (IF NOT EXISTS / guarded DO blocks). Isolated in
-- its own `contest` schema — this migration never touches cbt.* (plan §5.1).
-- Mirrored by the runtime-ensure block in src/server/contest/contest-schema.ts
-- (ensureContestSchema), so an un-migrated database self-heals on first use.
--
-- Hybrid state model (plan §2): contests.status carries the PIPELINE states
-- (draft → scheduled → result_processing → result_published → archived). The
-- pre-close phases UPCOMING/LIVE/ENDED are DERIVED at read time from NOW() vs
-- the window columns while status = 'scheduled' — they are never stored.

CREATE SCHEMA IF NOT EXISTS contest;

-- ── contests: definition + schedule + scoring config + pipeline state ────────
CREATE TABLE IF NOT EXISTS contest.contests (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,                 -- "Origin Weekly #N"
  subjects         JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { subject: [topic,…] }
  banner_url       TEXT,
  -- All schedule instants are TIMESTAMPTZ (UTC). display_tz is an IANA zone
  -- used only for admin-facing / "7pm IST" copy — never for window math.
  reg_open         TIMESTAMPTZ,
  reg_close        TIMESTAMPTZ,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  display_tz       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  duration_seconds INTEGER,                       -- derived = end_at - start_at, stored for the player
  -- Configurable Contest Points policy (a grader ScoringPolicy variant).
  scoring_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ogcode_reward    INTEGER NOT NULL DEFAULT 0,    -- OGCode points awarded on eligible completion (kept separate)
  -- Pipeline state (the persisted half of the hybrid state machine).
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','result_processing','result_published','archived')),
  created_by       TEXT REFERENCES origin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contests_status_start
  ON contest.contests(status, start_at);

-- ── contest_questions: FROZEN paper (immutable snapshot at publish) ──────────
-- question_id keeps the source OGCode id for traceability, but grading reads the
-- snapshot so a later OGCode edit never changes what was scored (plan §2, §5.5).
CREATE TABLE IF NOT EXISTS contest.contest_questions (
  contest_id     TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,               -- canonical order; display order is a per-user shuffle of this
  question_id    TEXT NOT NULL,
  subject        TEXT,
  section_id     TEXT,
  snapshot       JSONB NOT NULL,                 -- frozen stem/options/correct-answer/explanation
  marks          DOUBLE PRECISION,
  negative_marks DOUBLE PRECISION,
  PRIMARY KEY (contest_id, position)
);

-- ── registrations: authoritative eligibility + tie-breaker timestamp ─────────
CREATE TABLE IF NOT EXISTS contest.registrations (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)             -- one registration per user per contest
);

CREATE INDEX IF NOT EXISTS idx_registrations_user
  ON contest.registrations(user_id, registered_at DESC);

-- ── attempts: one logical rated attempt per (contest, user) ──────────────────
-- registered_at is DENORMALISED here (from registrations, at attempt-start) so
-- the ranking index is single-table. finalize_reason is CLOSE-CAUSE ONLY; the
-- cheat-status axis is review_status (plan §2, §4/§5).
CREATE TABLE IF NOT EXISTS contest.attempts (
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  registered_at      TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  auto_submitted     BOOLEAN NOT NULL DEFAULT false,
  finalize_reason    TEXT CHECK (finalize_reason IN ('manual','auto','deadline')),
  violation_count    INTEGER NOT NULL DEFAULT 0,
  review_status      TEXT NOT NULL DEFAULT 'none'
                       CHECK (review_status IN ('none','flagged','cleared','upheld')),
  score              DOUBLE PRECISION,
  correct_count      INTEGER,
  incorrect_count    INTEGER,
  unattempted_count  INTEGER,
  time_taken_seconds INTEGER,
  section_scores     JSONB,
  -- eligibility for ORBIT/leaderboard = review_status NOT IN ('flagged','upheld');
  -- stored so the rating batch reads one column.
  eligibility        BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

-- Deterministic single-table ranking index (score desc, time asc, earlier reg
-- wins ties, user_id as the final total-order tiebreak).
CREATE INDEX IF NOT EXISTS idx_attempts_rank
  ON contest.attempts(contest_id, score DESC, time_taken_seconds ASC, registered_at ASC, user_id);

-- ── answer_drafts: durable checkpoint of the live draft (Redis is the hot store)
-- Partitioned by contest_id so a finished contest's drafts drop as one unit.
CREATE TABLE IF NOT EXISTS contest.answer_drafts (
  contest_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  palette     JSONB NOT NULL DEFAULT '{}'::jsonb,
  times       JSONB NOT NULL DEFAULT '{}'::jsonb,
  rev         BIGINT NOT NULL DEFAULT 0,          -- monotonic; last-write-wins on drain
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
) PARTITION BY LIST (contest_id);

-- Default partition catches rows until a contest gets its own partition at
-- publish time (CREATE TABLE … PARTITION OF … FOR VALUES IN (<contest_id>)).
CREATE TABLE IF NOT EXISTS contest.answer_drafts_default
  PARTITION OF contest.answer_drafts DEFAULT;

-- ── submission_answers: IMMUTABLE per-question graded snapshot ───────────────
-- Source of DPP-from-mistakes + re-grade-on-review. Includes question_id and the
-- frozen snapshot so it never drifts from a later OGCode edit. Partitioned by
-- contest_id (a weekly contest is ~90M rows; partition to drop/archive per event).
CREATE TABLE IF NOT EXISTS contest.submission_answers (
  contest_id        TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  position          INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  question_snapshot JSONB NOT NULL,
  submitted_answer  JSONB,
  is_correct        BOOLEAN,
  marks_awarded     DOUBLE PRECISION,
  time_spent_seconds INTEGER,
  PRIMARY KEY (contest_id, user_id, position)
) PARTITION BY LIST (contest_id);

CREATE TABLE IF NOT EXISTS contest.submission_answers_default
  PARTITION OF contest.submission_answers DEFAULT;

-- ── leaderboard_snapshot: materialised rank + percentile (batch, post-close) ─
-- The ONLY source of final rank. Keyset paged by (contest_id, rank).
CREATE TABLE IF NOT EXISTS contest.leaderboard_snapshot (
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  rank               INTEGER NOT NULL,
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  score              DOUBLE PRECISION NOT NULL,
  time_taken_seconds INTEGER,
  registered_at      TIMESTAMPTZ,
  percentile         DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (contest_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshot_user
  ON contest.leaderboard_snapshot(contest_id, user_id);

-- ── orbit_ratings: full Glicko-2 state (provisional is DERIVED from rd) ──────
CREATE TABLE IF NOT EXISTS contest.orbit_ratings (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  current_rating  DOUBLE PRECISION NOT NULL DEFAULT 1000,
  rd              DOUBLE PRECISION NOT NULL DEFAULT 350,   -- high rd ⇒ provisional
  volatility      DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  games_played    INTEGER NOT NULL DEFAULT 0,
  previous_rating DOUBLE PRECISION,
  highest_rating  DOUBLE PRECISION,
  lowest_rating   DOUBLE PRECISION,
  rating_change   DOUBLE PRECISION,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── orbit_history: per-contest delta (audit + idempotent replay) ─────────────
CREATE TABLE IF NOT EXISTS contest.orbit_history (
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  rating_before      DOUBLE PRECISION,
  rating_after       DOUBLE PRECISION,
  rd_before          DOUBLE PRECISION,
  rd_after           DOUBLE PRECISION,
  volatility_before  DOUBLE PRECISION,
  volatility_after   DOUBLE PRECISION,
  rating_change      DOUBLE PRECISION,
  rank               INTEGER,
  percentile         DOUBLE PRECISION,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contest_id)
);

-- ── reward_ledger: idempotent OGCode reward (NEVER read by the rating batch) ─
CREATE TABLE IF NOT EXISTS contest.reward_ledger (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  ogcode_points INTEGER NOT NULL,
  awarded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)             -- exactly-once per user per contest
);

-- ── practice_progress: pre-contest engagement (Phase 2c) ─────────────────────
CREATE TABLE IF NOT EXISTS contest.practice_progress (
  contest_id      TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  per_subject     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { subject: {attempted, correct} } → Prep Score + Accuracy
  attempted_count INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

-- ── gamification: streaks, badges, personal bests (Phase 8) ──────────────────
CREATE TABLE IF NOT EXISTS contest.streaks (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_contest_id TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest.badges (
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  badge      TEXT NOT NULL,                      -- 'top_1_percent' | 'speedster' | 'sharpshooter' | 'comeback' | 'origin_legend'
  contest_id TEXT REFERENCES contest.contests(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);

CREATE TABLE IF NOT EXISTS contest.personal_bests (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  highest_orbit   DOUBLE PRECISION,
  best_rank       INTEGER,
  best_percentile DOUBLE PRECISION,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
