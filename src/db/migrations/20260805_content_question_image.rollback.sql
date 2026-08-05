-- Rollback: drop content.question_versions.image_url — 2026-08-05
-- Only run if reverting the Phase-0 teacher-authoring-fixes migration.
ALTER TABLE content.question_versions
  DROP COLUMN IF EXISTS image_url;
