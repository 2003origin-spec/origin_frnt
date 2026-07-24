-- Rollback for 20260724_platform_settings.sql. Drops the durable KV settings
-- table. Safe only if no feature depends on stored settings at the time.

BEGIN;

DROP TABLE IF EXISTS app.platform_settings;

DELETE FROM app.migrations WHERE id = '20260724_platform_settings';

COMMIT;
