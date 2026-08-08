-- Rollback for 20260808_cbt_participation_quota.sql
--
-- Drops ONLY what that migration added. Dropping participation_ledger destroys
-- the consumption record, so a re-apply starts every teacher back at zero used —
-- fine, because dropping the columns removes the caps too.

DROP INDEX IF EXISTS cbt.idx_cbt_participation_requests_status;
DROP INDEX IF EXISTS cbt.uq_cbt_participation_request_pending;
DROP TABLE IF EXISTS cbt.participation_requests;

DROP INDEX IF EXISTS cbt.idx_cbt_participation_ledger_room;
DROP INDEX IF EXISTS cbt.idx_cbt_participation_ledger_teacher;
DROP TABLE IF EXISTS cbt.participation_ledger;

ALTER TABLE cbt.teachers
  DROP CONSTRAINT IF EXISTS cbt_teachers_quota_reset_check,
  DROP CONSTRAINT IF EXISTS cbt_teachers_participation_quota_check;

ALTER TABLE cbt.teachers
  DROP COLUMN IF EXISTS quota_period_anchor,
  DROP COLUMN IF EXISTS quota_period_days,
  DROP COLUMN IF EXISTS quota_reset_mode,
  DROP COLUMN IF EXISTS quota_notified_at,
  DROP COLUMN IF EXISTS quota_updated_at,
  DROP COLUMN IF EXISTS participation_quota;
