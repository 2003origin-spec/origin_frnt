-- Rollback: drop import-review image columns — 2026-08-05
ALTER TABLE import.import_job_questions
  DROP COLUMN IF EXISTS image_url;
ALTER TABLE import.import_job_questions
  DROP COLUMN IF EXISTS option_images;
