-- Rollback for 20261021_payments_open_institute_orders.sql (USER database).
-- The index can also simply stay; nothing depends on it for correctness.

DROP INDEX IF EXISTS payments.idx_payments_orders_enrollment_open;
