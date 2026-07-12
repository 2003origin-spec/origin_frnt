-- Rollback for 20260712_ogcode_scoring_v2.sql
DROP INDEX IF EXISTS ogcode_question_progress_question_idx;
DROP TABLE IF EXISTS ogcode_question_progress;
