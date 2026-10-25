-- Bug-fix P5 (docs/bug-fixes/05-payments-entitlements.md): double charge on
-- institute offerings. USER database.
--
-- Two checkout clicks used to mint two payments.orders rows (and two Razorpay
-- orders) for ONE commerce.enrollment_orders row. Checkout now reuses the open
-- money order per `notes.enrollment_order_id`, and a second capture for the
-- same enrolment is flagged `duplicate_of` and auto-refunded. This index backs
-- both lookups. Additive, idempotent, `IF NOT EXISTS`; mirrored in
-- PAYMENTS_SCHEMA_SQL (src/server/payments/payments-schema.ts).

CREATE INDEX IF NOT EXISTS idx_payments_orders_enrollment_open
  ON payments.orders((notes->>'enrollment_order_id'))
  WHERE kind = 'institute_offering' AND status IN ('created', 'attempted', 'paid', 'partially_refunded');
