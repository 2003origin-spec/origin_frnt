-- Rollback for 20260823_payments_rail_b_ledger.sql (USER database).
--
-- Dropping last_event_at only loses the ordering fence; the subscription rows
-- themselves are untouched. After a rollback the transition functions revert
-- to last-writer-wins, which is the pre-Phase-6 behaviour.

DROP INDEX IF EXISTS payments.idx_payments_payments_orphan_sub;

ALTER TABLE IF EXISTS subscriptions.user_subscriptions   DROP COLUMN IF EXISTS last_event_at;
ALTER TABLE IF EXISTS commerce.enrollment_subscriptions  DROP COLUMN IF EXISTS last_event_at;
