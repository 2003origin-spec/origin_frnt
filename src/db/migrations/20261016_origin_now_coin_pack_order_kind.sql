-- 20261016_origin_now_coin_pack_order_kind: adds 'coin_pack' to
-- payments.order_kind for Origin NOW Ori Coins packs.
-- Additive and idempotent. Mirrored at runtime by ensureCoinPackOrderKind()
-- (src/server/now/coin-pack-payments.ts), which runs before the first
-- coin-pack checkout. An added enum value cannot be used in the transaction
-- that added it, so this file holds nothing else.
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT yet in scripts/run-migrations.mjs (decision B2).

ALTER TYPE payments.order_kind ADD VALUE IF NOT EXISTS 'coin_pack';
