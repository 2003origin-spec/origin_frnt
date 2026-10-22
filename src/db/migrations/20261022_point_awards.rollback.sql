-- Rollback for 20261022_point_awards.sql. Drops the claim table only; point
-- logs / user scores are untouched (re-applying the migration + re-running
-- scripts/backfill-point-awards.ts re-seeds the historical claims).
DROP TABLE IF EXISTS app.point_awards;
DELETE FROM app.migrations WHERE id = '20261022_point_awards';
