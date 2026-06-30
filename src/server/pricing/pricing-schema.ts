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
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON pricing.coupon_redemptions(user_id, code);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemption_subscription
      ON pricing.coupon_redemptions(code, subscription_id)
      WHERE subscription_id IS NOT NULL;
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
