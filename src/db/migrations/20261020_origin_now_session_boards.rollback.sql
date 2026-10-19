-- Rollback for 20261020_origin_now_session_boards.sql.
DROP TABLE IF EXISTS now.session_boards;
DELETE FROM app.migrations WHERE id = '20261020_origin_now_session_boards';
