-- Rollback for 20261020_origin_now_store_refund_kind.sql. Fails while any
-- store_refund transfer exists (export now.ledger_transfers first; never
-- delete ledger rows that moved real coins).
ALTER TABLE now.ledger_transfers DROP CONSTRAINT IF EXISTS ledger_transfers_kind_check;
ALTER TABLE now.ledger_transfers ADD CONSTRAINT ledger_transfers_kind_check CHECK (kind IN (
  'welcome_grant', 'pack_purchase', 'promo_bonus', 'session_hold', 'session_capture',
  'session_release', 'extension', 'tip', 'commission', 'transfer', 'store_spend',
  'expiry', 'admin_adjustment', 'pack_refund'
));
DELETE FROM app.migrations WHERE id = '20261020_origin_now_store_refund_kind';
