-- Rollback for 20261022_cbt_grading_status.sql
-- Drops only what that migration added. Scores, submissions and ranks are
-- untouched. Rows still 'pending' at rollback time go back to the old
-- behaviour (finished, score NULL, never retried), so drain the regrade sweep
-- first if possible:
--   SELECT COUNT(*) FROM cbt.room_participants WHERE grading_status <> 'done';
--
-- Manual-only; the migration runner never executes rollback files.

DROP INDEX IF EXISTS cbt.idx_cbt_participants_grading_pending;

ALTER TABLE cbt.room_participants DROP CONSTRAINT IF EXISTS cbt_participants_grading_status_check;

ALTER TABLE cbt.room_participants
  DROP COLUMN IF EXISTS grading_status,
  DROP COLUMN IF EXISTS grading_attempts,
  DROP COLUMN IF EXISTS grading_error,
  DROP COLUMN IF EXISTS grading_next_attempt_at;

DELETE FROM app.migrations WHERE id = '20261022_cbt_grading_status';
