-- Razorpay payments Phase 7 lifecycle (USER database).
--
-- Refund/dispute metadata, reconciliation indexes, and the paid-grant
-- ownership invariant.  The latter is deliberately an all-status unique
-- index: once an order's grant has been revoked, a late capture event must
-- not be able to create a second grant for that same order and subject.
-- Additive and idempotent; mirrors the runtime ensures in the payments and
-- subject-grants schema modules.

DO $$
BEGIN
  IF to_regclass('payments.payments') IS NOT NULL THEN
    ALTER TABLE payments.payments
      ADD COLUMN IF NOT EXISTS dispute_id TEXT,
      ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dispute_status TEXT,
      ADD COLUMN IF NOT EXISTS dispute_raw JSONB;

    CREATE INDEX IF NOT EXISTS idx_payments_payments_dispute
      ON payments.payments(disputed_at)
      WHERE disputed_at IS NOT NULL;
  END IF;

  IF to_regclass('payments.orders') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_payments_orders_reconcile
      ON payments.orders(status, created_at)
      WHERE status IN ('created', 'attempted');
  END IF;

  IF to_regclass('entitlements.subject_grants') IS NOT NULL THEN
    DROP INDEX IF EXISTS entitlements.uq_subject_grants_active_paid;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_paid_order_subject
      ON entitlements.subject_grants(order_id, subject)
      WHERE source = 'paid_order' AND order_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_subject_grants_paid_expiry
      ON entitlements.subject_grants(user_id, expires_at)
      WHERE source = 'paid_order' AND status = 'active';
  END IF;

  IF to_regclass('subscriptions.user_subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_subscriptions_reconcile
      ON subscriptions.user_subscriptions(status, current_period_end)
      WHERE status IN ('active', 'pending', 'halted', 'cancelled', 'completed');
  END IF;

  IF to_regclass('commerce.enrollment_subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_enrollment_subscriptions_reconcile
      ON commerce.enrollment_subscriptions(status, current_period_end)
      WHERE status IN ('active', 'pending', 'halted', 'cancelled', 'completed');
  END IF;
END $$;

INSERT INTO app.migrations (id, name)
VALUES ('20260823_payments_phase7_lifecycle', 'payments phase 7 refunds disputes reconciliation dunning')
ON CONFLICT (id) DO NOTHING;
