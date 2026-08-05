-- Rollback: drop ogcode_questions.option_images — 2026-08-05
ALTER TABLE ogcode_questions
  DROP COLUMN IF EXISTS option_images;
