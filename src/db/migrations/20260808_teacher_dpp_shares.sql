-- Teacher test → batch DPP shares — 2026-08-08
-- Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 0)
--
-- WHAT THIS ADDS
--   • assessment.teacher_dpp_shares — one row per "share this test as a DPP"
--     action. Holds the ordered question-id snapshot (D5) and the institute
--     branding snapshot (D6) so neither a later test edit nor a logo re-upload
--     can mutate an in-flight student DPP. `expires_at` is the 30-day lifetime.
--   • assessment.teacher_dpp_share_batches — the batches a share targets. A
--     test can be shared to many batches; deleting a batch drops only its link.
--
-- The student's personal DPP row is NOT written here — it is materialized
-- lazily on read into analytics.dpp_plans (different pool; see the companion
-- migration 20260808_dpp_plans_teacher_origin.sql). That is what makes roster
-- changes propagate and revocation a one-row operation.
--
-- Purely additive and idempotent; safe to re-run.

CREATE SCHEMA IF NOT EXISTS assessment;

CREATE TABLE IF NOT EXISTS assessment.teacher_dpp_shares (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT,
  duration_minutes INTEGER NOT NULL,
  -- Ordered snapshot of the test's question ids at share time (OG Code ids and
  -- content.questions ids both resolve through buildQuestionLookup).
  question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Institute branding snapshot for the highlighted student card.
  teacher_display_name TEXT NOT NULL,
  teacher_logo_url TEXT,
  shared_by TEXT NOT NULL REFERENCES origin_users(id),
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_workspace
  ON assessment.teacher_dpp_shares(workspace_id, shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_test
  ON assessment.teacher_dpp_shares(test_id, shared_at DESC);
-- Drives both the sweeper and the student eligibility read.
CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_expiry
  ON assessment.teacher_dpp_shares(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS assessment.teacher_dpp_share_batches (
  share_id TEXT NOT NULL REFERENCES assessment.teacher_dpp_shares(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  PRIMARY KEY (share_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_dpp_share_batches_batch
  ON assessment.teacher_dpp_share_batches(batch_id);
