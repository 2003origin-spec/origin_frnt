-- DPP presentation mode carried to the student's plan — 2026-08-09
-- Plan: V1/DPP_PRESENTATION_MODE_PLAN.md (Phase 2)
--
-- Mirrors assessment.teacher_dpp_shares.show_all_questions into the student's
-- materialized plan (analytics pool / OGCODE database). TRUE = all questions at
-- once ("Institute mode"); FALSE (default) = one at a time.
-- Metadata-only ADD COLUMN with a constant default. Additive + idempotent.

ALTER TABLE analytics.dpp_plans
  ADD COLUMN IF NOT EXISTS show_all_questions BOOLEAN NOT NULL DEFAULT FALSE;
