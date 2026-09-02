-- Rollback: Contest document-import bank flags.
DROP INDEX IF EXISTS ogcode_questions_contest_import_idx;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS contest_practice_eligible;
ALTER TABLE ogcode_questions DROP COLUMN IF EXISTS is_contest_import;
