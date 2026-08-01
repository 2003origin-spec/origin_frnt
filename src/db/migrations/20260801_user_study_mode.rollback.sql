-- Rollback for 20260801_user_study_mode.sql
-- Dropping the columns discards every student's mode choice; on re-apply they
-- return to "never chosen" (= PCMB, everything visible), which is the safe state.
ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_study_mode_check;
ALTER TABLE origin_users DROP COLUMN IF EXISTS study_mode_prompted_at;
ALTER TABLE origin_users DROP COLUMN IF EXISTS study_mode;
