-- Rollback for 20261022_odg_applied_attempts. Drops the applied-attempts ledger
-- only; mastery rows are untouched (retries would double-apply again).

DROP TABLE IF EXISTS odg.applied_attempts;
