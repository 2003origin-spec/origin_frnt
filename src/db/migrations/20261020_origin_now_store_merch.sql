-- 20261020_origin_now_store_merch: merch with delivery in the Origin Store (decision B91):
-- sizes with their own stock, the order's size and delivery address, and the
-- packing / shipping states. The `store_refund` ledger kind is its own file,
-- 20261020_origin_now_store_refund_kind.sql. Additive; idempotent. Apply AFTER 20261016_origin_now_core.sql.
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

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_store_merch', 'origin now: merch with delivery in the store')
  ON CONFLICT (id) DO NOTHING;
