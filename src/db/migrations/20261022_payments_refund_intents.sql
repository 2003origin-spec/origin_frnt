-- Refund intents (USER database).
--
-- initiateRefund used to hold the payment row lock (and, with the per-user
-- payments lock, every payment transaction for that student) across the
-- Razorpay refund HTTP call. It now records the initiation here in a short
-- transaction, calls Razorpay with nothing held, then records the refund and
-- deletes the intent. One row per payment: a second admin initiation while
-- one is in flight is refused. An ambiguous Razorpay answer (timeout, 5xx)
-- leaves the row in state 'unknown'; it is resolved against Razorpay's refunds
-- for the payment before another refund may be sent (as is a 'sending' row
-- older than the service's TTL). An admin can abandon an unknown row that
-- Razorpay still shows no refund for after the settle window: it is kept
-- (abandoned_at / abandoned_by set) for the audit trail and no longer blocks.
-- Purely additive; mirrors the runtime ensure in
-- src/server/payments/payments-schema.ts.

DO $$
BEGIN
  IF to_regclass('payments.payments') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS payments.refund_intents (
      razorpay_payment_id TEXT PRIMARY KEY
                            REFERENCES payments.payments(razorpay_payment_id) ON DELETE CASCADE,
      intent_id           TEXT NOT NULL,
      amount_minor        INTEGER NOT NULL CHECK (amount_minor > 0),
      initiated_by        TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      state               TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending', 'unknown')),
      abandoned_at        TIMESTAMPTZ,
      abandoned_by        TEXT
    );
    -- Re-runnable for a database that applied the first version of this file.
    ALTER TABLE payments.refund_intents
      ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending', 'unknown'));
    ALTER TABLE payments.refund_intents ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;
    ALTER TABLE payments.refund_intents ADD COLUMN IF NOT EXISTS abandoned_by TEXT;
  END IF;

  IF to_regclass('app.migrations') IS NOT NULL THEN
    INSERT INTO app.migrations (id, name)
    VALUES ('20261022_payments_refund_intents', 'payments refund intents (no lock across the Razorpay call)')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
