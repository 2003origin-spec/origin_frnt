/**
 * Admin Control Plane — coupons (Phase 5).
 *
 * Discount codes for PLATFORM subject/bundle subscriptions only (per the locked
 * decision). A coupon may be attributed to a coaching center for tracking but does
 * not change institute offering prices. Validation enforces the active window +
 * global and per-user redemption limits. Redemptions use a short-lived
 * reserve -> commit/release lifecycle; recurring subscriptions reuse a cached
 * Razorpay plan shape rather than creating one plan per student.
 */

import "server-only";

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";
import { invalidatePricingCache } from "@/server/payments/pricing-cache";

import { ensurePricingSchema } from "./pricing-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type CouponExecutor = Pick<Pool | PoolClient, "query">;

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
  if (coupon.validTo && new Date(coupon.validTo).getTime() <= now) return { valid: false, reason: "This coupon has expired." };
  if (coupon.appliesTo !== "any" && coupon.appliesTo !== input.target.kind) {
    return { valid: false, reason: `This coupon only applies to ${coupon.appliesTo} purchases.` };
  }
  if (
    coupon.appliesTo === "subject" &&
    coupon.subject &&
    String(coupon.subject).trim().toLowerCase() !== String(input.target.subject ?? "").trim().toLowerCase()
  ) {
    return { valid: false, reason: `This coupon only applies to ${coupon.subject}.` };
  }

  // `times_redeemed` includes active holds for fast admin reporting, but a
  // preview must not reject a code merely because an expired hold has not yet
  // been swept by reconciliation.
  if (coupon.maxRedemptions != null) {
    const active = await pool().query<{ n: string }>(
      `SELECT COUNT(*)::int AS n
         FROM pricing.coupon_redemptions
        WHERE code = $1
          AND (state = 'committed' OR (state = 'reserved' AND (expires_at IS NULL OR expires_at > NOW())))`,
      [code],
    );
    if (Number(active.rows[0]?.n ?? 0) >= coupon.maxRedemptions) {
      return { valid: false, reason: "This coupon has reached its redemption limit." };
    }
  }

  const used = await pool().query<{ n: string }>(
    `SELECT COUNT(*)::int AS n
       FROM pricing.coupon_redemptions
      WHERE code = $1 AND user_id = $2
        AND (state = 'committed' OR (state = 'reserved' AND (expires_at IS NULL OR expires_at > NOW())))`,
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

export type CouponReservation = {
  id: string;
  code: string;
  userId: string;
  orderId: string | null;
  subscriptionId: string | null;
  state: "reserved" | "committed" | "released";
  amountDiscountedMinor: number;
};

/** Checkout holds are deliberately short-lived.  A student who abandons the
 * Razorpay sheet must not consume a limited coupon for the rest of the day. */
export const COUPON_RESERVATION_TTL_MS = 30 * 60 * 1000;

function reservationFromRow(row: Record<string, unknown>): CouponReservation {
  return {
    id: String(row.id),
    code: String(row.code),
    userId: String(row.user_id),
    orderId: row.order_id == null ? null : String(row.order_id),
    subscriptionId: row.subscription_id == null ? null : String(row.subscription_id),
    state: row.state as CouponReservation["state"],
    amountDiscountedMinor: Number(row.amount_discounted_minor) || 0,
  };
}

async function reserveCouponInTransaction(input: {
  code: string;
  userId: string;
  subject?: string | null;
  /** Authoritative purchase target.  Legacy callers can omit it and the
   * subscription/order identifier is used to infer the old subject rail. */
  targetKind?: CouponAppliesTo;
  orderId?: string | null;
  subscriptionId?: string | null;
  amountDiscountedMinor: number;
  expiresAt?: Date;
  /** Legacy subscription callers may not have a gateway id yet. */
  allowLegacyWithoutIdentity?: boolean;
}, exec: CouponExecutor): Promise<CouponReservation> {
  const code = normalizeCode(input.code);
  if (!code || !input.userId) throw new Error("Coupon code and user are required");
  if (!input.orderId && !input.subscriptionId && !input.allowLegacyWithoutIdentity) {
    throw new Error("Coupon reservation needs an order or subscription");
  }

  const couponResult = await exec.query(
    `SELECT * FROM pricing.coupons WHERE code = $1 FOR UPDATE`,
    [code],
  );
  const coupon = couponResult.rows[0] as Record<string, unknown> | undefined;
  if (!coupon) throw new Error("Coupon not found.");
  if (!Boolean(coupon.active)) throw new Error("This coupon is no longer active.");

  const now = Date.now();
  const validFrom = coupon.valid_from == null ? null : new Date(String(coupon.valid_from)).getTime();
  const validTo = coupon.valid_to == null ? null : new Date(String(coupon.valid_to)).getTime();
  if (validFrom != null && (!Number.isFinite(validFrom) || validFrom > now)) {
    throw new Error("This coupon isn't active yet.");
  }
  if (validTo != null && (!Number.isFinite(validTo) || validTo <= now)) {
    throw new Error("This coupon has expired.");
  }

  const targetKind: "subject" | "bundle" = input.targetKind === "bundle" ? "bundle" : "subject";
  // An omitted targetKind is retained for the legacy subscription rail.  An
  // order caller always passes it explicitly; never allow a bundle coupon to
  // be applied to a subject subscription (or vice versa).
  const appliesTo = String(coupon.applies_to ?? "any") as CouponAppliesTo;
  if (appliesTo !== "any" && appliesTo !== targetKind) {
    throw new Error(`This coupon only applies to ${appliesTo} purchases.`);
  }
  const couponSubject = coupon.subject == null ? null : String(coupon.subject).trim().toLowerCase();
  const targetSubject = input.subject == null ? null : String(input.subject).trim().toLowerCase();
  if (appliesTo === "subject" && couponSubject && couponSubject !== targetSubject) {
    throw new Error(`This coupon only applies to ${couponSubject}.`);
  }
  const discounted = Number(input.amountDiscountedMinor);
  if (!Number.isFinite(discounted) || discounted < 0) {
    throw new Error("Coupon discount must be a non-negative amount.");
  }

  // Expired holds are released while the coupon row is locked, so their
  // reservations cannot consume the global cap forever.
  const expired = await exec.query(
    `UPDATE pricing.coupon_redemptions
        SET state = 'released'
      WHERE code = $1 AND state = 'reserved' AND expires_at IS NOT NULL AND expires_at <= NOW()
      RETURNING id`,
    [code],
  );
  if ((expired.rowCount ?? 0) > 0) {
    await exec.query(
      `UPDATE pricing.coupons
          SET times_redeemed = GREATEST(0, times_redeemed - $2)
        WHERE code = $1`,
      [code, expired.rowCount],
    );
  }

  const existing = await exec.query(
    `SELECT * FROM pricing.coupon_redemptions
      WHERE code = $1 AND user_id = $2
        AND (($3::text IS NOT NULL AND order_id = $3) OR ($4::text IS NOT NULL AND subscription_id = $4))
        AND state <> 'released'
      LIMIT 1`,
    [code, input.userId, input.orderId ?? null, input.subscriptionId ?? null],
  );
  if (existing.rows[0]) return reservationFromRow(existing.rows[0]);

  // The legacy subscription helper historically allowed a redemption without
  // a gateway subscription id. Preserve that call contract and make retries
  // idempotent by reusing the one null-identity committed/held row.
  if (input.allowLegacyWithoutIdentity && !input.orderId && !input.subscriptionId) {
    const legacy = await exec.query(
      `SELECT * FROM pricing.coupon_redemptions
        WHERE code = $1 AND user_id = $2
          AND order_id IS NULL AND subscription_id IS NULL
          AND state <> 'released'
        ORDER BY redeemed_at DESC
        LIMIT 1`,
      [code, input.userId],
    );
    if (legacy.rows[0]) return reservationFromRow(legacy.rows[0]);
  }

  // A released row keeps its order/subscription identity under the partial
  // unique index. Recycle it instead of attempting a duplicate INSERT. This
  // makes a retry of the same checkout idempotent after a transient failure.
  const released = await exec.query(
    `SELECT * FROM pricing.coupon_redemptions
      WHERE code = $1 AND user_id = $2 AND state = 'released'
        AND (($3::text IS NOT NULL AND order_id = $3) OR ($4::text IS NOT NULL AND subscription_id = $4))
      LIMIT 1`,
    [code, input.userId, input.orderId ?? null, input.subscriptionId ?? null],
  );
  const releasedRow = released.rows[0] as Record<string, unknown> | undefined;

  const releasedLegacy = input.allowLegacyWithoutIdentity && !input.orderId && !input.subscriptionId
    ? (await exec.query(
        `SELECT * FROM pricing.coupon_redemptions
          WHERE code = $1 AND user_id = $2
            AND order_id IS NULL AND subscription_id IS NULL
            AND state = 'released'
          ORDER BY redeemed_at DESC
          LIMIT 1`,
        [code, input.userId],
      )).rows[0] as Record<string, unknown> | undefined
    : undefined;
  const reusableReleasedRow = releasedRow ?? releasedLegacy;

  const perUserLimit = Number(coupon.per_user_limit) || 1;
  const used = await exec.query<{ n: string }>(
    `SELECT COUNT(*)::int AS n
       FROM pricing.coupon_redemptions
      WHERE code = $1 AND user_id = $2
        AND (state = 'committed' OR (state = 'reserved' AND (expires_at IS NULL OR expires_at > NOW())))`,
    [code, input.userId],
  );
  if (!reusableReleasedRow && Number(used.rows[0]?.n ?? 0) >= perUserLimit) {
    throw new Error("You have already used this coupon.");
  }

  // Guard the global cap in the UPDATE itself.  The coupon row is locked above,
  // so this remains safe even when callers use a larger transaction around the
  // reservation.  A zero-row result means another reservation exhausted it.
  // Every new hold, including recycling a released row, consumes one counted
  // slot. Release/expiry decremented the counter, so skipping this UPDATE on
  // recycle would let `times_redeemed` drift below the number of active holds
  // and eventually oversell a capped coupon.
  const bumped = await exec.query(
    `UPDATE pricing.coupons
        SET times_redeemed = times_redeemed + 1
      WHERE code = $1
        AND active = TRUE
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_to IS NULL OR valid_to > NOW())
        AND (max_redemptions IS NULL OR times_redeemed < max_redemptions)
      RETURNING *`,
      [code],
  );
  if (!bumped.rows[0]) throw new Error("This coupon has reached its redemption limit.");

  const requestedExpiry = input.expiresAt ?? new Date(Date.now() + COUPON_RESERVATION_TTL_MS);
  if (!Number.isFinite(requestedExpiry.getTime())) throw new Error("Invalid coupon reservation expiry");
  if (reusableReleasedRow) {
    const recycled = await exec.query(
      `UPDATE pricing.coupon_redemptions
          SET subject = $2, amount_discounted_minor = $3, state = 'reserved', expires_at = $4,
              redeemed_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        reusableReleasedRow.id,
        input.subject ?? null,
        Math.max(0, Math.round(discounted)),
        requestedExpiry,
      ],
    );
    return reservationFromRow(recycled.rows[0]);
  }

  const inserted = await exec.query(
    `INSERT INTO pricing.coupon_redemptions
       (id, code, user_id, subject, subscription_id, amount_discounted_minor, state, order_id, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,'reserved',$7,$8)
     RETURNING *`,
    [
      createPrefixedId("cpnr"),
      code,
      input.userId,
      input.subject ?? null,
      input.subscriptionId ?? null,
      Math.max(0, Math.round(discounted)),
      input.orderId ?? null,
      requestedExpiry,
    ],
  );
  return reservationFromRow(inserted.rows[0]);
}

/** Reserve one coupon redemption atomically. The reservation is idempotent per order/subscription. */
export async function reserveCoupon(input: {
  code: string;
  userId: string;
  subject?: string | null;
  targetKind?: CouponAppliesTo;
  orderId?: string | null;
  subscriptionId?: string | null;
  amountDiscountedMinor: number;
  expiresAt?: Date;
}, exec?: CouponExecutor): Promise<CouponReservation> {
  await ensurePricingSchema();
  if (exec) return reserveCouponInTransaction(input, exec);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const reservation = await reserveCouponInTransaction(input, client);
    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Commits a previously reserved coupon. A duplicate commit is a no-op. */
export async function commitCouponReservation(input: {
  code: string;
  userId: string;
  reservationId?: string | null;
  orderId?: string | null;
  subscriptionId?: string | null;
}, exec?: CouponExecutor): Promise<boolean> {
  if (exec) {
    // Lock the coupon row first, matching reserve/release lock ordering and
    // preventing a stale-hold cleanup from racing this transition.
    await exec.query(`SELECT code FROM pricing.coupons WHERE code = $1 FOR UPDATE`, [normalizeCode(input.code)]);
    const result = await exec.query(
      `UPDATE pricing.coupon_redemptions
          SET state = 'committed', expires_at = NULL
        WHERE code = $1 AND user_id = $2 AND state = 'reserved'
          AND (
            ($3::text IS NOT NULL AND id = $3)
            OR ($4::text IS NOT NULL AND order_id = $4)
            OR ($5::text IS NOT NULL AND subscription_id = $5)
          )
        RETURNING id`,
      [
        normalizeCode(input.code),
        input.userId,
        input.reservationId ?? null,
        input.orderId ?? null,
        input.subscriptionId ?? null,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }
  await ensurePricingSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const committed = await commitCouponReservation(input, client);
    await client.query("COMMIT");
    return committed;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Releases a reservation and returns its slot to the global cap. */
export async function releaseCouponReservation(input: {
  code: string;
  userId: string;
  orderId?: string | null;
  subscriptionId?: string | null;
}, exec?: CouponExecutor): Promise<boolean> {
  if (exec) {
    await exec.query(`SELECT code FROM pricing.coupons WHERE code = $1 FOR UPDATE`, [normalizeCode(input.code)]);
    const result = await exec.query(
      `UPDATE pricing.coupon_redemptions
          SET state = 'released', expires_at = NULL
        WHERE code = $1 AND user_id = $2 AND state = 'reserved'
          AND (($3::text IS NOT NULL AND order_id = $3) OR ($4::text IS NOT NULL AND subscription_id = $4))
        RETURNING id`,
      [normalizeCode(input.code), input.userId, input.orderId ?? null, input.subscriptionId ?? null],
    );
    if ((result.rowCount ?? 0) > 0) {
      await exec.query(
        `UPDATE pricing.coupons SET times_redeemed = GREATEST(0, times_redeemed - 1) WHERE code = $1`,
        [normalizeCode(input.code)],
      );
    }
    return (result.rowCount ?? 0) > 0;
  }
  await ensurePricingSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const released = await releaseCouponReservation(input, client);
    await client.query("COMMIT");
    return released;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rebinds a reservation made against a local subscription intent to the
 * Razorpay subscription id returned by the gateway. This closes the race where
 * two checkout requests could create external subscriptions before either had
 * a gateway id with which to reserve the coupon.
 */
export async function rebindCouponReservation(input: {
  code: string;
  userId: string;
  fromSubscriptionId: string;
  toSubscriptionId: string;
}, exec?: CouponExecutor): Promise<boolean> {
  const code = normalizeCode(input.code);
  if (!exec) await ensurePricingSchema();
  if (exec) {
    await exec.query(`SELECT code FROM pricing.coupons WHERE code = $1 FOR UPDATE`, [code]);
    const result = await exec.query(
      `UPDATE pricing.coupon_redemptions
          SET subscription_id = $4
        WHERE code = $1 AND user_id = $2 AND subscription_id = $3 AND state = 'reserved'
        RETURNING id`,
      [code, input.userId, input.fromSubscriptionId, input.toSubscriptionId],
    );
    return (result.rowCount ?? 0) > 0;
  }
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const rebound = await rebindCouponReservation(input, client);
    await client.query("COMMIT");
    return rebound;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Records a committed redemption for the legacy subscription rail. */
export async function redeemCoupon(input: {
  code: string;
  userId: string;
  subject?: string | null;
  subscriptionId?: string | null;
  amountDiscountedMinor: number;
}): Promise<void> {
  await ensurePricingSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const reservation = await reserveCouponInTransaction(
      {
        ...input,
        targetKind: "subject",
        subscriptionId: input.subscriptionId ?? null,
        allowLegacyWithoutIdentity: !input.subscriptionId,
      },
      client,
    );
    await commitCouponReservation(
      {
        code: reservation.code,
        userId: reservation.userId,
        reservationId: reservation.id,
        subscriptionId: reservation.subscriptionId,
      },
      client,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
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
  const coupon = rowToCoupon(res.rows[0]);
  await invalidatePricingCache();
  return coupon;
}

export async function setCouponActive(code: string, active: boolean): Promise<void> {
  await ensurePricingSchema();
  await pool().query(`UPDATE pricing.coupons SET active = $2 WHERE code = $1`, [normalizeCode(code), active]);
  await invalidatePricingCache();
}
