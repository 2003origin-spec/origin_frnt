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
