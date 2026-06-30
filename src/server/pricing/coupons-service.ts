/**
 * Admin Control Plane — coupons (Phase 5).
 *
 * Discount codes for PLATFORM subject/bundle subscriptions only (per the locked
 * decision). A coupon may be attributed to a coaching center for tracking but does
 * not change institute offering prices. Validation enforces the active window +
 * global and per-user redemption limits. Redemption is recorded when a discounted
 * subscription is created (the discount is baked into a one-off Razorpay plan).
 */

import "server-only";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import { ensurePricingSchema } from "./pricing-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type CouponKind = "percent" | "flat";
export type CouponAppliesTo = "subject" | "bundle" | "any";

export type Coupon = {
  code: string;
  description: string | null;
  kind: CouponKind;
  value: number;
  appliesTo: CouponAppliesTo;
  subject: string | null;
  coachingCenterWorkspaceId: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  timesRedeemed: number;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  createdAt: string;
};

function rowToCoupon(row: Record<string, unknown>): Coupon {
  return {
    code: row.code as string,
    description: (row.description as string | null) ?? null,
    kind: row.kind as CouponKind,
    value: Number(row.value) || 0,
    appliesTo: row.applies_to as CouponAppliesTo,
    subject: (row.subject as string | null) ?? null,
    coachingCenterWorkspaceId: (row.coaching_center_workspace_id as string | null) ?? null,
    maxRedemptions: row.max_redemptions == null ? null : Number(row.max_redemptions),
    perUserLimit: Number(row.per_user_limit) || 1,
    timesRedeemed: Number(row.times_redeemed) || 0,
    validFrom: row.valid_from ? new Date(row.valid_from as string).toISOString() : null,
    validTo: row.valid_to ? new Date(row.valid_to as string).toISOString() : null,
    active: Boolean(row.active),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export type ValidateInput = {
  code: string;
  userId: string;
  target: { kind: "subject" | "bundle"; subject?: string; baseAmountMinor: number };
};

export type ValidateResult =
  | { valid: false; reason: string }
  | { valid: true; code: string; discountMinor: number; finalMinor: number };

export async function validateCoupon(input: ValidateInput): Promise<ValidateResult> {
  await ensurePricingSchema();
  const code = normalizeCode(input.code);
  if (!code) return { valid: false, reason: "Enter a coupon code." };

  const res = await pool().query(`SELECT * FROM pricing.coupons WHERE code = $1`, [code]);
  const row = res.rows[0];
  if (!row) return { valid: false, reason: "Coupon not found." };
  const coupon = rowToCoupon(row);

  if (!coupon.active) return { valid: false, reason: "This coupon is no longer active." };
  const now = Date.now();
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) return { valid: false, reason: "This coupon isn't active yet." };
  if (coupon.validTo && new Date(coupon.validTo).getTime() < now) return { valid: false, reason: "This coupon has expired." };
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    return { valid: false, reason: "This coupon has reached its redemption limit." };
  }
  if (coupon.appliesTo !== "any" && coupon.appliesTo !== input.target.kind) {
    return { valid: false, reason: `This coupon only applies to ${coupon.appliesTo} purchases.` };
  }
  if (coupon.appliesTo === "subject" && coupon.subject && input.target.subject && coupon.subject !== input.target.subject) {
    return { valid: false, reason: `This coupon only applies to ${coupon.subject}.` };
  }

  const used = await pool().query<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM pricing.coupon_redemptions WHERE code = $1 AND user_id = $2`,
    [code, input.userId],
  );
  if (Number(used.rows[0]?.n ?? 0) >= coupon.perUserLimit) {
    return { valid: false, reason: "You have already used this coupon." };
  }

  const base = input.target.baseAmountMinor;
  const rawDiscount = coupon.kind === "percent" ? Math.round((base * coupon.value) / 100) : coupon.value;
  const discountMinor = Math.max(0, Math.min(rawDiscount, base));
  return { valid: true, code, discountMinor, finalMinor: Math.max(0, base - discountMinor) };
}

/** Records a redemption + bumps the global counter. Idempotent per subscription. */
export async function redeemCoupon(input: {
  code: string;
  userId: string;
  subject?: string | null;
  subscriptionId?: string | null;
  amountDiscountedMinor: number;
}): Promise<void> {
  await ensurePricingSchema();
  const code = normalizeCode(input.code);
  const id = createPrefixedId("cpnr");
  const inserted = await pool().query(
    `INSERT INTO pricing.coupon_redemptions (id, code, user_id, subject, subscription_id, amount_discounted_minor)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (code, subscription_id) DO NOTHING
     RETURNING id`,
    [id, code, input.userId, input.subject ?? null, input.subscriptionId ?? null, input.amountDiscountedMinor],
  );
  if ((inserted.rowCount ?? 0) > 0) {
    await pool().query(`UPDATE pricing.coupons SET times_redeemed = times_redeemed + 1 WHERE code = $1`, [code]);
  }
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export async function listCoupons(): Promise<(Coupon & { redemptions: number })[]> {
  await ensurePricingSchema();
  const res = await pool().query(`SELECT * FROM pricing.coupons ORDER BY created_at DESC`);
  return res.rows.map((r) => ({ ...rowToCoupon(r), redemptions: Number(r.times_redeemed) || 0 }));
}

export async function createCoupon(input: {
  code: string;
  description?: string | null;
  kind: CouponKind;
  value: number;
  appliesTo: CouponAppliesTo;
  subject?: string | null;
  coachingCenterWorkspaceId?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number;
  validFrom?: string | null;
  validTo?: string | null;
  createdBy: string;
}): Promise<Coupon> {
  await ensurePricingSchema();
  const code = normalizeCode(input.code);
  const res = await pool().query(
    `INSERT INTO pricing.coupons
       (code, description, kind, value, applies_to, subject, coaching_center_workspace_id,
        max_redemptions, per_user_limit, valid_from, valid_to, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12)
     ON CONFLICT (code) DO UPDATE SET
       description = EXCLUDED.description, kind = EXCLUDED.kind, value = EXCLUDED.value,
       applies_to = EXCLUDED.applies_to, subject = EXCLUDED.subject,
       coaching_center_workspace_id = EXCLUDED.coaching_center_workspace_id,
       max_redemptions = EXCLUDED.max_redemptions, per_user_limit = EXCLUDED.per_user_limit,
       valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to
     RETURNING *`,
    [
      code,
      input.description ?? null,
      input.kind,
      input.value,
      input.appliesTo,
      input.subject ?? null,
      input.coachingCenterWorkspaceId ?? null,
      input.maxRedemptions ?? null,
      input.perUserLimit ?? 1,
      input.validFrom ?? null,
      input.validTo ?? null,
      input.createdBy,
    ],
  );
  return rowToCoupon(res.rows[0]);
}

export async function setCouponActive(code: string, active: boolean): Promise<void> {
  await ensurePricingSchema();
  await pool().query(`UPDATE pricing.coupons SET active = $2 WHERE code = $1`, [normalizeCode(code), active]);
}
