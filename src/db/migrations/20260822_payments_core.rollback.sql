-- Rollback for 20260822_payments_core.sql (USER database).
-- Drops the entire payments money ledger. Only run when removing the payments
-- epic altogether — this destroys the financial record. Take a dump first.

DROP TABLE IF EXISTS payments.idempotency_keys;
DROP TABLE IF EXISTS payments.outbox;
DROP TABLE IF EXISTS payments.events;
DROP TABLE IF EXISTS payments.refunds;
DROP TABLE IF EXISTS payments.payments;
DROP TABLE IF EXISTS payments.orders;
DROP TYPE  IF EXISTS payments.order_kind;
DROP TYPE  IF EXISTS payments.order_status;
DROP SCHEMA IF EXISTS payments;
