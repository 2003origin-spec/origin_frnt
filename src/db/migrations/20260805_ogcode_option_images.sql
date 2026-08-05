-- Per-option images in the OG Code catalog — 2026-08-05
-- Plan: V1/TEACHER_AUTHORING_FIXES_PLAN.md (Phase 0 / Phase 4)
--
-- WHAT THIS ADDS
--   • ogcode_questions.option_images — a JSONB array parallel to `options`,
--     holding a nullable image URL per option (["https://…", null, …]). Lets a
--     teacher-authored question published to OG Code keep its per-option images.
--     Without this column the publish path can only carry option *text*, so
--     per-option images were invisible in OG Code practice and OG-Code-pool DPPs.
--   The question-level diagram already has a home: ogcode_questions.image.
--
-- Metadata-only ADD COLUMN (nullable, no default) — no table rewrite on PG 11+.
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE ogcode_questions
  ADD COLUMN IF NOT EXISTS option_images JSONB;
