-- Contest tables that until now existed only in the runtime ensure
-- (ensureContestSchema in src/server/contest/contest-schema.ts) with no
-- migration or rollback. Copied verbatim from that file; the drift test
-- tests/unit/contest-migrations-drift.test.ts fails if the two diverge.
-- Idempotent; additive. Requires 20260819_contest_core.sql (contest schema).

-- Per-admin synthetic workspace bridge for Contest document-import (one hidden
-- personal teacher workspace per admin, cached here).
CREATE TABLE IF NOT EXISTS contest.admin_import_workspaces (
  user_id      TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student bookmarks on contest questions (Phase 6 improvement loop), with the
-- question snapshot copied in so a bookmark survives the contest paper.
CREATE TABLE IF NOT EXISTS contest.question_bookmarks (
  user_id           TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  contest_id        TEXT NOT NULL,
  position          INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  question_snapshot JSONB NOT NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contest_id, position)
);
CREATE INDEX IF NOT EXISTS idx_contest_bookmarks_user ON contest.question_bookmarks(user_id, created_at DESC);
