-- Rail B / Connect folded onto the unified payments ledger (USER database).
-- Plan: V1/RAZORPAY_PAYMENTS_PLAN.md Phase 6, edge case E27.
--
-- Two additive columns, both nullable, both defaulting to NULL so every
-- existing row keeps its current behaviour:
--
--   subscriptions.user_subscriptions.last_event_at
--   commerce.enrollment_subscriptions.last_event_at
--
-- They hold the Razorpay `created_at` of the most recent event that was
-- APPLIED to the row. A webhook whose event time is older than the stored
-- value is a re-delivery or an out-of-order delivery and must not walk the
-- subscription's state backwards (E27: "transition function is order-
-- independent; never downgrades active"). NULL means "no ordered event has
-- been applied yet", which always accepts — so a database that has not been
-- migrated behaves exactly as before.
--
-- GUARDED on to_regclass: neither table is in this allowlist (both were
-- created by earlier hand-applied migrations / runtime ensures), so on a
-- fresh preview database they may be absent. Skipping is safe because the
-- runtime-ensure modules create the column as part of the table shape.

DO $$
BEGIN
  IF to_regclass('subscriptions.user_subscriptions') IS NULL THEN
    RAISE NOTICE '[20260823_payments_rail_b_ledger] subscriptions.user_subscriptions absent — skipping; the runtime-ensure adds last_event_at.';
  ELSE
    ALTER TABLE subscriptions.user_subscriptions
      ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;
  END IF;

  IF to_regclass('commerce.enrollment_subscriptions') IS NULL THEN
    RAISE NOTICE '[20260823_payments_rail_b_ledger] commerce.enrollment_subscriptions absent — skipping; the runtime-ensure adds last_event_at.';
  ELSE
    ALTER TABLE commerce.enrollment_subscriptions
      ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;
  END IF;
END $$;

-- Rail B invoice charges land in payments.payments with order_id NULL and
-- subscription_id set. The existing idx_payments_payments_sub covers lookups
-- by subscription; this partial index covers the reconciliation query that
-- asks "which subscription charges have no local subscription row yet".
DO $$
BEGIN
  IF to_regclass('payments.payments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_payments_payments_orphan_sub
      ON payments.payments(subscription_id, created_at)
      WHERE order_id IS NULL AND subscription_id IS NOT NULL;
  END IF;
END $$;
