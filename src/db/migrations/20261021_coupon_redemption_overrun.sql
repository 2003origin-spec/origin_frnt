-- Bug-fix P2 (docs/bug-fixes/05-payments-entitlements.md): coupon hold released,
-- payment still succeeds. USER database.
--
-- A Razorpay order never expires gateway-side, so a capture can land after the
-- local coupon hold was released. The discount was already applied to the money
-- that landed, so the redemption is now re-committed at capture time; when the
-- cap had meanwhile been exhausted the row is flagged `overrun` and admins are
-- alerted. Additive and idempotent; mirrored by the runtime-ensure in
-- src/server/pricing/pricing-schema.ts.
--
-- Rollout: run this first (instant, no rewrite), deploy the code, then size and
-- heal the historic leak with scripts/backfill-coupon-late-commits.ts.

DO $$
BEGIN
  IF to_regclass('pricing.coupon_redemptions') IS NULL THEN
    RAISE NOTICE '[20261021_coupon_redemption_overrun] pricing.coupon_redemptions absent — skipping; the runtime-ensure creates it with this column present.';
  ELSE
    ALTER TABLE pricing.coupon_redemptions
      ADD COLUMN IF NOT EXISTS overrun BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_overrun
      ON pricing.coupon_redemptions(code) WHERE overrun;
  END IF;
END $$;
