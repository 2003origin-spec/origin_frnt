-- Rollback for 20261111_counselling_cutoffs.sql — drops the counselling schema
-- (public closing-rank data only; re-import with `npm run counselling:import`).

DROP SCHEMA IF EXISTS counselling CASCADE;

DELETE FROM app.migrations WHERE id = '20261111_counselling_cutoffs';
