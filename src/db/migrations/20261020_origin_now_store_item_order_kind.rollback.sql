-- Rollback for 20261020_origin_now_store_item_order_kind.sql.
-- Postgres cannot drop a single enum value. 'store_item' is left in place; it
-- is harmless while no order uses it. To remove it you must recreate the type,
-- which first requires deleting or re-kinding every store_item order:
--   SELECT count(*) FROM payments.orders WHERE kind = 'store_item';
SELECT 1;
