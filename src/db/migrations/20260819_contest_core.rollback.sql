-- Rollback for 20260819_contest_core.sql (USER database).
--
-- Drops the ENTIRE contest.* schema and every contest, attempt, submission,
-- rating, and reward it holds. This is destructive — only run it if the Weekly
-- Contest + ORBIT feature is being removed outright. It touches nothing else
-- (the contest schema is fully isolated; cbt.* and app.* are untouched).
--
-- CASCADE drops the partitions (answer_drafts_default, submission_answers_default,
-- and any per-contest partitions) and all indexes with the schema.

DROP SCHEMA IF EXISTS contest CASCADE;
