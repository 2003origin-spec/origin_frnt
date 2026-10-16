-- Rollback for 20261017_origin_now_coin_redemption_grant.sql.
-- Removes coin-bought premium first (those rows would violate the narrowed
-- CHECK), then restores the previous source list. Note the affected users
-- BEFORE running it and recompute their premium flags afterwards:
--   SELECT DISTINCT user_id FROM entitlements.subject_grants WHERE source = 'coin_redemption';
-- The coins they spent are NOT returned by this rollback.
DELETE FROM entitlements.subject_grants WHERE source = 'coin_redemption';
ALTER TABLE entitlements.subject_grants DROP CONSTRAINT IF EXISTS subject_grants_source_check;
ALTER TABLE entitlements.subject_grants
  ADD CONSTRAINT subject_grants_source_check
  CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order'));
DELETE FROM app.migrations WHERE id = '20261017_origin_now_coin_redemption_grant';
