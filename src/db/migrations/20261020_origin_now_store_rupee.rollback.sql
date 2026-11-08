-- Rollback for 20261020_origin_now_store_rupee.sql.
DROP INDEX IF EXISTS store.idx_store_orders_placed;
DROP INDEX IF EXISTS store.idx_store_orders_payment;
ALTER TABLE store.orders DROP COLUMN IF EXISTS payment_order_id;
DELETE FROM app.migrations WHERE id = '20261020_origin_now_store_rupee';
