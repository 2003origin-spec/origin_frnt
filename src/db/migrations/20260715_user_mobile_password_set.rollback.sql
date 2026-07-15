-- Rollback for 20260715_user_mobile_password_set.sql
DROP INDEX IF EXISTS idx_origin_users_mobile;
ALTER TABLE origin_users DROP COLUMN IF EXISTS password_set;
ALTER TABLE origin_users DROP COLUMN IF EXISTS mobile;
