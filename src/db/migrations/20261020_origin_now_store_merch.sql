-- 20261020_origin_now_store_merch: merch with delivery in the Origin Store (decision B91):
-- sizes with their own stock, the order's size and delivery address, the
-- packing / shipping states, and a `store_refund` ledger kind for cancelled
-- orders. Additive and guarded; idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

ALTER TABLE store.items ADD COLUMN IF NOT EXISTS size_stock JSONB;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS delivery JSONB;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS ship_status TEXT
  CHECK (ship_status IS NULL OR ship_status IN ('to_pack', 'packed', 'shipped', 'delivered', 'cancelled'));
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS courier TEXT;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS tracking_no TEXT;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS address_purged_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_store_orders_ship ON store.orders(ship_status, created_at) WHERE ship_status IS NOT NULL;
DO $$
DECLARE constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
   WHERE conrelid = 'now.ledger_transfers'::regclass AND conname = 'ledger_transfers_kind_check';
  IF constraint_def IS NULL OR position('store_refund' IN constraint_def) = 0 THEN
    ALTER TABLE now.ledger_transfers DROP CONSTRAINT IF EXISTS ledger_transfers_kind_check;
    ALTER TABLE now.ledger_transfers ADD CONSTRAINT ledger_transfers_kind_check CHECK (kind IN (
      'welcome_grant', 'pack_purchase', 'promo_bonus', 'session_hold', 'session_capture',
      'session_release', 'extension', 'tip', 'commission', 'transfer', 'store_spend',
      'expiry', 'admin_adjustment', 'pack_refund', 'store_refund'
    ));
  END IF;
END $$;

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_store_merch', 'origin now: merch with delivery in the store')
  ON CONFLICT (id) DO NOTHING;
