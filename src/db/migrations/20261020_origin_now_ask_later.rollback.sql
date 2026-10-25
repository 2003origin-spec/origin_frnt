-- Rollback for 20261020_origin_now_ask_later.sql.
ALTER TABLE now.reports DROP COLUMN IF EXISTS later_request_id;
DROP TABLE IF EXISTS now.later_requests;
DELETE FROM app.migrations WHERE id = '20261020_origin_now_ask_later';
