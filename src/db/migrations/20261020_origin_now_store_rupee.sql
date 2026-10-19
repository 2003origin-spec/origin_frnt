-- 20261020_origin_now_store_rupee: store items with a rupee price (decision B92):
-- links a store order to its payments.orders row. Additive; idempotent.
-- Apply AFTER 20261020_origin_now_store_merch.sql. The payment kind itself is
-- added by 20261020_origin_now_store_item_order_kind.sql (run that one alone).
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

ALTER TABLE store.orders ADD COLUMN IF NOT EXISTS payment_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_store_orders_payment ON store.orders(payment_order_id) WHERE payment_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_placed ON store.orders(created_at) WHERE status = 'placed';

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_store_rupee', 'origin now: store orders paid partly in rupees')
  ON CONFLICT (id) DO NOTHING;
