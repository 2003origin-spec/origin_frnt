-- Coupon reservation lifecycle + term ladder + Razorpay plan cache (USER database).
-- Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §5.3 (Phase 1), decisions D4 + D11.
--
-- Three concerns, all additive and idempotent:
--   1. pricing.coupon_redemptions gains a reserve→commit/release lifecycle so an
--      abandoned checkout stops burning a student's per_user_limit (gap G4) and a
--      limited coupon cannot be oversold under concurrency (gap G5).
--   2. Admin-editable MRP (list price) + term ladder, so "change the price / show a
--      discount / sell a 3-month plan" is admin data, not a deploy.
--   3. pricing.razorpay_plans caches plans by SHAPE, so a discounted subscription
--      reuses an existing plan instead of minting a new one per redemption (G4).

CREATE SCHEMA IF NOT EXISTS pricing;

-- GUARDED: pricing.coupon_redemptions / subject_prices / bundle_offers are
-- created by 20260630_admin_pricing.sql, which is NOT in the run-migrations
-- allowlist (applied by hand in prod). On a fresh preview database they are
-- absent, and this file must not fail the build. It skips those ALTERs instead,
-- and src/server/pricing/pricing-schema.ts creates all three with the new
-- columns already present, so the skip can never leave the DB wrong.

DO $$
BEGIN
  IF to_regclass('pricing.coupon_redemptions') IS NULL THEN
    RAISE NOTICE '[20260822_payments_coupons] pricing.* absent — skipping the ALTERs; the runtime-ensure creates them with these columns already present.';
  ELSE
    -- 1. Coupon redemption lifecycle: reserve → commit | release.
    ALTER TABLE pricing.coupon_redemptions
      ADD COLUMN IF NOT EXISTS state      TEXT NOT NULL DEFAULT 'committed',
      ADD COLUMN IF NOT EXISTS order_id   TEXT,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

    -- Existing rows predate the lifecycle and are all real redemptions, so the
    -- 'committed' default above is correct for them.
    ALTER TABLE pricing.coupon_redemptions
      DROP CONSTRAINT IF EXISTS coupon_redemptions_state_check;
    ALTER TABLE pricing.coupon_redemptions
      ADD CONSTRAINT coupon_redemptions_state_check
      CHECK (state IN ('reserved', 'committed', 'released'));

    DROP INDEX IF EXISTS pricing.uq_coupon_redemption_subscription;
    DROP INDEX IF EXISTS pricing.uq_coupon_redemption_order;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
      ON pricing.coupon_redemptions(code, subscription_id)
      WHERE subscription_id IS NOT NULL AND state IN ('reserved', 'committed');
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_order
      ON pricing.coupon_redemptions(code, order_id)
      WHERE order_id IS NOT NULL AND state IN ('reserved', 'committed');
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_reserved
      ON pricing.coupon_redemptions(state, expires_at) WHERE state = 'reserved';

    -- 2. MRP (display-only strike-through price).
    ALTER TABLE pricing.subject_prices ADD COLUMN IF NOT EXISTS list_amount_minor INTEGER;
    ALTER TABLE pricing.bundle_offers  ADD COLUMN IF NOT EXISTS list_amount_minor INTEGER;
  END IF;
END $$;

-- ── Admin-editable term ladder (no prerequisites) ──────────────────────
CREATE TABLE IF NOT EXISTS pricing.term_options (
  term_months      INTEGER PRIMARY KEY CHECK (term_months > 0),
  label            TEXT NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by       TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the launch ladder (plan D4). ON CONFLICT DO NOTHING so a redeploy never
-- clobbers an admin's retuned discounts.
INSERT INTO pricing.term_options (term_months, label, discount_percent, sort_order) VALUES
  (1,  'Monthly',   0,  1),
  (3,  '3 months',  10, 2),
  (12, '12 months', 25, 3)
ON CONFLICT (term_months) DO NOTHING;

-- ── 3. Razorpay plan cache, keyed on plan SHAPE ────────────────────────────
CREATE TABLE IF NOT EXISTS pricing.razorpay_plans (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  subject      TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency     TEXT NOT NULL DEFAULT 'INR',
  period       TEXT NOT NULL DEFAULT 'monthly',
  livemode     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_razorpay_plans_shape
  ON pricing.razorpay_plans(kind, COALESCE(subject, ''), amount_minor, currency, period, livemode);
