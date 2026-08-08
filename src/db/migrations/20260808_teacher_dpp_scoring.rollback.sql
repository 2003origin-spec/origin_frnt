-- Rollback for 20260808_teacher_dpp_scoring.sql
--
-- Drops the marks snapshot. Shared DPPs keep working — they fall back to the
-- default practice scoring policy, exactly as they did before the column
-- existed. No question ids or shares are touched.

ALTER TABLE assessment.teacher_dpp_shares DROP COLUMN IF EXISTS question_marks;
