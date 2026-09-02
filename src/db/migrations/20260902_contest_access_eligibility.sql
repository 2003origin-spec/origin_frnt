-- Contest access & eligibility (Phase 5). Additive + idempotent. USER database.
-- Mirrored by ensureContestSchema() (src/server/contest/contest-schema.ts).

ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'open'
  CHECK (access_mode IN ('open','code','premium'));
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS registration_cap INTEGER;

ALTER TABLE contest.registrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered'
  CHECK (status IN ('registered','waitlisted'));
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist
  ON contest.registrations(contest_id, status, registered_at);

CREATE TABLE IF NOT EXISTS contest.access_codes (
  contest_id   TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  redeemed_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  redeemed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, code)
);
CREATE INDEX IF NOT EXISTS idx_access_codes_contest ON contest.access_codes(contest_id);

-- Phase 7: per-question discussion comments.
CREATE TABLE IF NOT EXISTS contest.question_comments (
  id          TEXT PRIMARY KEY,
  contest_id  TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  user_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_comments_q
  ON contest.question_comments(contest_id, position, created_at);

-- Phase 2A: answer-key objections.
CREATE TABLE IF NOT EXISTS contest.key_objections (
  id           TEXT PRIMARY KEY,
  contest_id   TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  user_id      TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  resolved_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_key_objections_contest ON contest.key_objections(contest_id, status);

-- Phase 3B: webcam-snapshot proctoring refs.
CREATE TABLE IF NOT EXISTS contest.proctor_snapshots (
  id          TEXT PRIMARY KEY,
  contest_id  TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proctor_snapshots ON contest.proctor_snapshots(contest_id, user_id, captured_at);

-- Phase 5 remainder: team contests.
CREATE TABLE IF NOT EXISTS contest.teams (
  id          TEXT PRIMARY KEY,
  contest_id  TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  join_code   TEXT NOT NULL,
  captain_id  TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, join_code)
);
CREATE TABLE IF NOT EXISTS contest.team_members (
  team_id     TEXT NOT NULL REFERENCES contest.teams(id) ON DELETE CASCADE,
  contest_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  UNIQUE (contest_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_contest ON contest.team_members(contest_id);
