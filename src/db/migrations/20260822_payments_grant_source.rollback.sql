-- Rollback for 20260822_payments_grant_source.sql (USER database).
--
-- WARNING: narrowing the CHECK fails if any source='paid_order' row exists.
-- Revoke or delete those rows first (they represent PAID access — do not drop
-- them casually):
--   UPDATE entitlements.subject_grants SET status='revoked' WHERE source='paid_order';
--   DELETE FROM entitlements.subject_grants WHERE source='paid_order';

DROP INDEX IF EXISTS entitlements.uq_subject_grants_active_paid;
DROP INDEX IF EXISTS entitlements.idx_subject_grants_order;

ALTER TABLE entitlements.subject_grants
  DROP CONSTRAINT IF EXISTS subject_grants_source_check;

ALTER TABLE entitlements.subject_grants
  ADD CONSTRAINT subject_grants_source_check
  CHECK (source IN ('teacher_code', 'admin_comp'));

ALTER TABLE entitlements.subject_grants DROP COLUMN IF EXISTS order_id;
