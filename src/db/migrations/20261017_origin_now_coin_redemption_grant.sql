-- 20261017_origin_now_coin_redemption_grant: lets Origin Store premium bought
-- with Ori Coins be an entitlements.subject_grants row (source
-- 'coin_redemption', with expires_at). The entitlement read path already
-- counts every active grant, so nothing else changes.
-- Additive and idempotent; guarded so an already-correct database issues no
-- DDL (an unguarded re-ADD takes an AccessExclusiveLock on every run).
-- Mirrored at runtime by ensureCoinRedemptionGrantSource()
-- (src/server/now/store-service.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT yet in scripts/run-migrations.mjs (decision B2).

DO $$
DECLARE constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
   WHERE conrelid = 'entitlements.subject_grants'::regclass
     AND conname = 'subject_grants_source_check';

  IF constraint_def IS NULL OR position('coin_redemption' IN constraint_def) = 0 THEN
    ALTER TABLE entitlements.subject_grants DROP CONSTRAINT IF EXISTS subject_grants_source_check;
    ALTER TABLE entitlements.subject_grants
      ADD CONSTRAINT subject_grants_source_check
      CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order', 'coin_redemption'));
  END IF;
END $$;

INSERT INTO app.migrations (id, name) VALUES ('20261017_origin_now_coin_redemption_grant', 'origin now coin_redemption grant source') ON CONFLICT (id) DO NOTHING;
