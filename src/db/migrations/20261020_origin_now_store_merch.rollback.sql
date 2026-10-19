-- Rollback for 20261020_origin_now_store_merch.sql.
-- Cancelled-order refunds must be gone before the kind is narrowed again.
ALTER TABLE now.ledger_transfers DROP CONSTRAINT IF EXISTS ledger_transfers_kind_check;
ALTER TABLE now.ledger_transfers ADD CONSTRAINT ledger_transfers_kind_check CHECK (kind IN (
  'welcome_grant', 'pack_purchase', 'promo_bonus', 'session_hold', 'session_capture',
  'session_release', 'extension', 'tip', 'commission', 'transfer', 'store_spend',
  'expiry', 'admin_adjustment', 'pack_refund'
));
DROP INDEX IF EXISTS store.idx_store_orders_ship;
ALTER TABLE store.orders DROP COLUMN IF EXISTS address_purged_at, DROP COLUMN IF EXISTS cancel_reason,
  DROP COLUMN IF EXISTS cancelled_at, DROP COLUMN IF EXISTS delivered_at, DROP COLUMN IF EXISTS shipped_at,
  DROP COLUMN IF EXISTS tracking_no, DROP COLUMN IF EXISTS courier, DROP COLUMN IF EXISTS ship_status,
  DROP COLUMN IF EXISTS delivery, DROP COLUMN IF EXISTS size;
ALTER TABLE store.items DROP COLUMN IF EXISTS size_stock;
DELETE FROM app.migrations WHERE id = '20261020_origin_now_store_merch';
