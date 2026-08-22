-- Public, sanitized, revocable share links for a contest result (plan Phase 8
-- growth loop). One opt-in slug per (contest, user); the public page renders a
-- SANITIZED card (rank/percentile/score/ORBIT — never answers/email/full name)
-- and deep-links to the landing with a "Beat my ORBIT" CTA. Idempotent.

CREATE TABLE IF NOT EXISTS contest.share_links (
  slug        TEXT PRIMARY KEY,
  contest_id  TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One slug per participant per contest (idempotent generate; re-share reuses).
  UNIQUE (contest_id, user_id)
);
