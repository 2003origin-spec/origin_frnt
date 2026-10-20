-- 20261020_origin_now_store_item_order_kind: adds 'store_item' to
-- payments.order_kind for Origin Store items with a rupee price (B92).
-- Additive and idempotent. Mirrored at runtime by ensureStoreItemOrderKind()
-- (src/server/now/store-checkout.ts), which runs before the first such
-- checkout. An added enum value cannot be used in the transaction that added
-- it, so this file holds nothing else: run it on its own.
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

ALTER TYPE payments.order_kind ADD VALUE IF NOT EXISTS 'store_item';
