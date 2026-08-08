-- Scored + cohort-stamped teacher DPP attempts — 2026-08-08
-- Plan: V1/allmd/TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md (Phase A)
--
-- WHAT THIS ADDS
--   • analytics.dpp_plans.batch_id — which batch of the share this student's
--     DPP came through. workspace_id / origin / teacher_share_id are already on
--     this table, so this one column is all that is needed to make every
--     teacher-facing aggregate a dpp_attempts ⋈ dpp_plans join INSIDE the
--     OGCODE pool — no cross-pool join, and no second copy of cohort truth that
--     could drift. (analytics.test_results had to carry its own stamps because
--     a test submission has no plan row behind it.)
--
--   • analytics.dpp_attempts.score / total_marks / percentage — the marks-based
--     result of the attempt. buildAnalyticsAttempts already computes all three
--     and submitGeneratedDpp threw them away, keeping only the correct-count
--     progress_score. Persisting them makes the practice leaderboard a plain
--     SUM/AVG over indexed columns instead of a re-grade, and means a student's
--     recorded score can never change because a question was edited later.
--
-- progress_score is deliberately NOT touched — the student-facing DPP UI reads
-- it, and changing its meaning would alter a shipped surface.
--
-- NULL score on rows written before this migration is meaningful: those
-- attempts are EXCLUDED from the practice leaderboard rather than counted as
-- zero. A DPP solved before scoring existed is not a zero-score attempt, and
-- ranking it as one would mis-rank real students.
--
-- Lives in the analytics/OGCODE database. Metadata-only ADD COLUMNs — no table
-- rewrite on PG 11+. Purely additive and idempotent; safe to re-run. Mirrored
-- by the runtime-ensure DDL in src/legacy/analytics-store.ts.

ALTER TABLE analytics.dpp_plans ADD COLUMN IF NOT EXISTS batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_dpp_plans_batch
  ON analytics.dpp_plans (workspace_id, batch_id, origin);

ALTER TABLE analytics.dpp_attempts ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;
ALTER TABLE analytics.dpp_attempts ADD COLUMN IF NOT EXISTS total_marks DOUBLE PRECISION;
ALTER TABLE analytics.dpp_attempts ADD COLUMN IF NOT EXISTS percentage DOUBLE PRECISION;

-- Drives "latest attempt per plan", which is how the practice board stops a
-- student farming rank by re-submitting the same DPP.
CREATE INDEX IF NOT EXISTS idx_analytics_dpp_attempts_plan_created
  ON analytics.dpp_attempts (dpp_id, created_at DESC);
