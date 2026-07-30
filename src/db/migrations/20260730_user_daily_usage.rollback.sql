-- Rollback: drop per-user daily AI usage history.

BEGIN;

DROP INDEX IF EXISTS idx_origin_user_daily_usage_user_date;
DROP INDEX IF EXISTS idx_origin_user_daily_usage_date;
DROP TABLE IF EXISTS origin_user_daily_usage;

DELETE FROM app.migrations WHERE id = '20260730_user_daily_usage';

COMMIT;
