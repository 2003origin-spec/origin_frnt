-- Rollback for 20260823_payments_phase7_lifecycle.sql (USER database).
--
-- This removes only Phase 7 metadata/indexes.  Recreating the old
-- one-active-paid-grant index is intentionally omitted: after Phase 7 there
-- may be multiple active grants for one subject, one per paid order, and
-- silently collapsing them would be data loss.  A deliberate data migration
-- is required if a deployment must return to the pre-Phase-7 model.

DROP INDEX IF EXISTS entitlements.idx_subject_grants_paid_expiry;
DROP INDEX IF EXISTS entitlements.uq_subject_grants_paid_order_subject;
DROP INDEX IF EXISTS subscriptions.idx_user_subscriptions_reconcile;
DROP INDEX IF EXISTS commerce.idx_enrollment_subscriptions_reconcile;
DROP INDEX IF EXISTS payments.idx_payments_payments_dispute;
DROP INDEX IF EXISTS payments.idx_payments_orders_reconcile;

ALTER TABLE IF EXISTS payments.payments
  DROP COLUMN IF EXISTS dispute_id,
  DROP COLUMN IF EXISTS disputed_at,
  DROP COLUMN IF EXISTS dispute_status,
  DROP COLUMN IF EXISTS dispute_raw;

DELETE FROM app.migrations
 WHERE id = '20260823_payments_phase7_lifecycle';
