-- Rollback for 20261018_origin_now_roster.sql. Drops the roster table (the
-- planned evenings only; nothing else depends on it).
DROP TABLE IF EXISTS now.roster;
DELETE FROM app.migrations WHERE id = '20261018_origin_now_roster';
