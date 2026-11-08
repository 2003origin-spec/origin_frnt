-- Rollback for 20261020_origin_now_group_sessions.sql.
ALTER TABLE now.reports DROP COLUMN IF EXISTS group_session_id;
DROP TABLE IF EXISTS now.group_seats;
DROP TABLE IF EXISTS now.group_sessions;
DELETE FROM app.migrations WHERE id = '20261020_origin_now_group_sessions';
