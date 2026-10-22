-- Rollback for 20261021_coupon_redemption_overrun.sql (USER database).
-- Revert the code first; the column's FALSE default is harmless if it stays.

DROP INDEX IF EXISTS pricing.idx_coupon_redemptions_overrun;
ALTER TABLE pricing.coupon_redemptions DROP COLUMN IF EXISTS overrun;
