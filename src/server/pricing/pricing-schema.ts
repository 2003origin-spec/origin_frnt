/**
 * Runtime-ensure for the Admin Control Plane pricing schema:
 *   pricing.subject_prices — admin-editable per-subject price + Razorpay plan id.
 *   pricing.bundle_offers  — admin-editable all-subjects bundle offer.
 *
 * Both are additive and idempotent. Canonical SQL:
 *   src/db/migrations/20260630_admin_pricing.sql
 *
 * Entitlement is unchanged — these tables only drive the *price/plan* used when a
 * NEW subscription is created and the price shown to students. Existing
 * subscriptions keep their original Razorpay plan (new-subscriptions-only policy).
 */

import "server-only";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originPricingSchemaEnsured: boolean | undefined;
  var __originPricingSchemaPromise: Promise<void> | undefined;
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function ensure(client: PoolClient): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS pricing;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS pricing.subject_prices (
      subject TEXT PRIMARY KEY CHECK (subject IN ('physics','chemistry','mathematics','biology')),
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      list_amount_minor INTEGER,
      currency TEXT NOT NULL DEFAULT 'INR',
      razorpay_plan_id TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS pricing.bundle_offers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subjects TEXT[] NOT NULL DEFAULT ARRAY['physics','chemistry','mathematics','biology']::text[],
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      list_amount_minor INTEGER,
      currency TEXT NOT NULL DEFAULT 'INR',
      razorpay_plan_id TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_bundle_offers_active ON pricing.bundle_offers(active);
  `);

  // Coupons (Phase 5) — discount codes for PLATFORM subject/bundle subscriptions.
  await client.query(`
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
      state TEXT NOT NULL DEFAULT 'committed'
        CHECK (state IN ('reserved', 'committed', 'released')),
      order_id TEXT,
      expires_at TIMESTAMPTZ,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON pricing.coupon_redemptions(user_id, code);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
      ON pricing.coupon_redemptions(code, subscription_id)
      WHERE subscription_id IS NOT NULL AND state IN ('reserved', 'committed');
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_order
      ON pricing.coupon_redemptions(code, order_id)
      WHERE order_id IS NOT NULL AND state IN ('reserved', 'committed');
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_reserved
      ON pricing.coupon_redemptions(state, expires_at) WHERE state = 'reserved';
  `);

  // Existing installations may have the pre-Phase-5 indexes whose predicates
  // included released rows. Rebuild them once so a released reservation can be
  // retained for audit without blocking a later order/subscription identity.
  await client.query(`
    DROP INDEX IF EXISTS pricing.uq_coupon_redemption_subscription;
    DROP INDEX IF EXISTS pricing.uq_coupon_redemption_order;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
      ON pricing.coupon_redemptions(code, subscription_id)
      WHERE subscription_id IS NOT NULL AND state IN ('reserved', 'committed');
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_order
      ON pricing.coupon_redemptions(code, order_id)
      WHERE order_id IS NOT NULL AND state IN ('reserved', 'committed');
  `);

  // Admin-editable term ladder (payments plan D4). Seeded once; ON CONFLICT DO
  // NOTHING so a redeploy never clobbers an admin's retuned discounts.
  await client.query(`
    CREATE TABLE IF NOT EXISTS pricing.term_options (
      term_months      INTEGER PRIMARY KEY CHECK (term_months > 0),
      label            TEXT NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
      sort_order       INTEGER NOT NULL DEFAULT 0,
      active           BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by       TEXT,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO pricing.term_options (term_months, label, discount_percent, sort_order) VALUES
      (1,  'Monthly',   0,  1),
      (3,  '3 months',  10, 2),
      (12, '12 months', 25, 3)
    ON CONFLICT (term_months) DO NOTHING;
  `);

  // Razorpay plan cache keyed on plan SHAPE, so a discounted subscription reuses
  // an existing plan instead of minting a new one per coupon redemption.
  await client.query(`
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
  `);

  // Self-heal a database created before the payments epic: add the columns the
  // CREATE TABLEs above only apply to a fresh table.
  //
  // GUARDED for the same reason as subject-grants-schema.ts: an unconditional
  // ALTER takes an AccessExclusiveLock on every cold start, re-validating the
  // CHECK against every row and deadlocking against ordinary row traffic. On an
  // already-correct database this issues no DDL at all.
  // Canonical SQL: src/db/migrations/20260822_payments_coupons.sql
  await client.query(`
    DO $$
    DECLARE constraint_def TEXT;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='pricing' AND table_name='subject_prices'
                        AND column_name='list_amount_minor') THEN
        ALTER TABLE pricing.subject_prices ADD COLUMN list_amount_minor INTEGER;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='pricing' AND table_name='bundle_offers'
                        AND column_name='list_amount_minor') THEN
        ALTER TABLE pricing.bundle_offers ADD COLUMN list_amount_minor INTEGER;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='pricing' AND table_name='coupon_redemptions'
                        AND column_name='state') THEN
        ALTER TABLE pricing.coupon_redemptions
          ADD COLUMN state      TEXT NOT NULL DEFAULT 'committed',
          ADD COLUMN order_id   TEXT,
          ADD COLUMN expires_at TIMESTAMPTZ;
      END IF;

      SELECT pg_get_constraintdef(oid) INTO constraint_def
        FROM pg_constraint
       WHERE conrelid = 'pricing.coupon_redemptions'::regclass
         AND conname = 'coupon_redemptions_state_check';

      IF constraint_def IS NULL OR position('reserved' IN constraint_def) = 0 THEN
        ALTER TABLE pricing.coupon_redemptions
          DROP CONSTRAINT IF EXISTS coupon_redemptions_state_check;
        ALTER TABLE pricing.coupon_redemptions
          ADD CONSTRAINT coupon_redemptions_state_check
          CHECK (state IN ('reserved', 'committed', 'released'));
      END IF;
    END $$;
  `);
}

export async function ensurePricingSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originPricingSchemaEnsured) return;
  if (!globalThis.__originPricingSchemaPromise) {
    globalThis.__originPricingSchemaPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        await ensure(client);
        await client.query("COMMIT");
        globalThis.__originPricingSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originPricingSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originPricingSchemaPromise;
}
