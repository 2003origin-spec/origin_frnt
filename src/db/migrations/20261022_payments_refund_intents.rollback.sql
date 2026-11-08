-- Rollback for 20261022_payments_refund_intents.sql (USER database).
--
-- Only transient in-flight markers live here; dropping the table loses no
-- ledger data. Roll back the refunds-service change first: the current
-- initiateRefund needs this table.

DROP TABLE IF EXISTS payments.refund_intents;

DELETE FROM app.migrations
 WHERE id = '20261022_payments_refund_intents';
