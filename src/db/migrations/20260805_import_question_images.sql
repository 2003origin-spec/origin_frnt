-- Manual images in document-import review — 2026-08-05
-- Plan: V1/TEACHER_AUTHORING_FIXES_PLAN.md (Phase 3)
--
-- WHAT THIS ADDS
--   • import.import_job_questions.image_url    — a question diagram uploaded
--     while reviewing an import job (OCR extracts figures but the review editor
--     had no way to attach one).
--   • import.import_job_questions.option_images — JSONB array parallel to
--     `options`, one nullable image URL per option.
--   Both are carried onto the Question Bag question at publish time
--   (publishImportQuestionToBag), so imported questions no longer land image-less.
--
-- Metadata-only ADD COLUMN (nullable, no default) — no table rewrite on PG 11+.
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE import.import_job_questions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE import.import_job_questions
  ADD COLUMN IF NOT EXISTS option_images JSONB;
