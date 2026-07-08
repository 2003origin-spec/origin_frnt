-- Rollback for ODG Phase 2. Drops the error-events table only; the Phase 1
-- graph and mastery tables are left intact.

DROP TABLE IF EXISTS odg.error_events;
