-- Rollback for 20261022_attempt_starts.sql. Drops the attempt-start table;
-- submit then falls back to the clamped client timeTaken (nothing else reads it).
DROP TABLE IF EXISTS analytics.attempt_starts;
DELETE FROM app.migrations WHERE id = '20261022_attempt_starts';
