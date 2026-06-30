-- Admin Control Plane — pricing schema (Phase 4).
-- Mirrored by the runtime-ensure src/server/pricing/pricing-schema.ts (auto-applies
-- on first use). Additive + idempotent; safe to re-run. Does not touch entitlement.

CREATE SCHEMA IF NOT EXISTS pricing;

CREATE TABLE IF NOT EXISTS pricing.subject_prices (
  subject TEXT PRIMARY KEY CHECK (subject IN ('physics','chemistry','mathematics','biology')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_plan_id TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing.bundle_offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT ARRAY['physics','chemistry','mathematics','biology']::text[],
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_plan_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundle_offers_active ON pricing.bundle_offers(active);

-- Coupons (Phase 5) — discount codes for platform subject/bundle subscriptions.
CREATE TABLE IF NOT EXISTS pricing.coupons (
  code TEXT PRIMARY KEY,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('percent','flat')),
  value INTEGER NOT NULL CHECK (value >= 0),
  applies_to TEXT NOT NULL DEFAULT 'any' CHECK (applies_to IN ('subject','bundle','any')),
  subject TEXT,
  coaching_center_workspace_id TEXT,
  max_redemptions INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  times_redeemed INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing.coupon_redemptions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES pricing.coupons(code) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  subject TEXT,
  subscription_id TEXT,
  amount_discounted_minor INTEGER NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON pricing.coupon_redemptions(user_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
  ON pricing.coupon_redemptions(code, subscription_id) WHERE subscription_id IS NOT NULL;
