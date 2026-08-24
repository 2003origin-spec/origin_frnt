-- Rollback for 20260822_payments_coupons.sql (USER database).
-- Drops the coupon reservation lifecycle, the term ladder and the plan cache.
-- Coupon redemption ROWS are preserved; only the lifecycle columns go.

DROP INDEX IF EXISTS pricing.uq_razorpay_plans_shape;
DROP TABLE IF EXISTS pricing.razorpay_plans;

DROP TABLE IF EXISTS pricing.term_options;

ALTER TABLE pricing.subject_prices DROP COLUMN IF EXISTS list_amount_minor;
ALTER TABLE pricing.bundle_offers  DROP COLUMN IF EXISTS list_amount_minor;

DROP INDEX IF EXISTS pricing.uq_coupon_redemption_order;
DROP INDEX IF EXISTS pricing.idx_coupon_redemptions_reserved;

ALTER TABLE pricing.coupon_redemptions
  DROP CONSTRAINT IF EXISTS coupon_redemptions_state_check;
ALTER TABLE pricing.coupon_redemptions
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS order_id,
  DROP COLUMN IF EXISTS expires_at;

-- Restore the pre-Phase-5 subscription uniqueness constraint that the forward
-- migration replaces with a state-aware predicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
  ON pricing.coupon_redemptions(code, subscription_id)
  WHERE subscription_id IS NOT NULL;
