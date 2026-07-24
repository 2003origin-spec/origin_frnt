-- Rollback for 20260724_user_lifecycle.sql. Drops the blocklist + the
-- account_status columns. Note: dropping account_status disables all revoke/
-- delete enforcement (fail-open to the pre-feature "everyone active" behaviour).

BEGIN;

DROP TABLE IF EXISTS app.deleted_identity_blocklist;

ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_account_status_check;
DROP INDEX IF EXISTS idx_origin_users_account_status;
ALTER TABLE origin_users DROP COLUMN IF EXISTS account_status;
ALTER TABLE origin_users DROP COLUMN IF EXISTS status_reason;
ALTER TABLE origin_users DROP COLUMN IF EXISTS status_changed_at;
ALTER TABLE origin_users DROP COLUMN IF EXISTS status_changed_by;

DELETE FROM app.migrations WHERE id = '20260724_user_lifecycle';

COMMIT;
