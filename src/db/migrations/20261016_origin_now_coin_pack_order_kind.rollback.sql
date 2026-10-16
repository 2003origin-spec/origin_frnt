-- Rollback for 20261016_origin_now_coin_pack_order_kind.sql.
-- Postgres cannot drop a single enum value. 'coin_pack' is left in place; it
-- is harmless while no order uses it. To remove it you must recreate the type,
-- which first requires deleting or re-kinding every coin_pack order:
--   SELECT count(*) FROM payments.orders WHERE kind = 'coin_pack';
SELECT 1;
