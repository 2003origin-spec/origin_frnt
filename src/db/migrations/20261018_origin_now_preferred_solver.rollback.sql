-- Rollback for 20261018_origin_now_preferred_solver.sql. Drops only the
-- "ask first" choice on requests; nothing else depends on it.
ALTER TABLE now.requests DROP COLUMN IF EXISTS preferred_helper_id;
DELETE FROM app.migrations WHERE id = '20261018_origin_now_preferred_solver';
