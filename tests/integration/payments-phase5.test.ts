/**
 * Phase 5 database acceptance: coupon reservations and bundle grants.
 *
 * These tests are intentionally skipped when USER_DATABASE_URL is unavailable,
 * matching the existing payment integration suites. The assertions exercise
 * the real row locks, unique indexes, payment transaction, and entitlement
 * grant path when a Postgres service is present.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };
let userId = "";
const couponCode = `PH5_${Date.now().toString(36).toUpperCase()}`;

test("setup: Phase 5 schemas, isolated student, bundle, and limited coupon", opts, async () => {
  const { ensurePaymentsAndGrantSchema } = await import("@/server/payments/payments-schema");
  await ensurePaymentsAndGrantSchema();
  userId = makeId("user_phase5");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, password_hash, role)
     VALUES ($1, 'Phase 5 Tester', $2, 'test-only', 'student')`,
    [userId, `${userId}@example.test`],
  );
  await rawPool().query(
    `INSERT INTO pricing.bundle_offers
       (id, name, subjects, amount_minor, currency, active, updated_at)
     VALUES ($1, 'Phase 5 bundle', $2::text[], 149900, 'INR', TRUE, NOW())`,
    [makeId("bundle"), ["physics", "chemistry", "mathematics", "biology"]],
  );
  await rawPool().query(
    `INSERT INTO pricing.coupons
       (code, kind, value, applies_to, max_redemptions, per_user_limit, active)
     VALUES ($1, 'percent', 50, 'subject', 1, 1, TRUE)`,
    [couponCode],
  );
});

test("bundle capture grants every snapshotted subject", opts, async () => {
  const { applyPaymentSuccess } = await import("@/server/payments/orders-service");
  const { attachRazorpayOrderId, insertOrder, newOrderId } = await import("@/server/payments/payments-store");
  const order = await insertOrder({
    id: newOrderId(),
    userId,
    kind: "bundle_term",
    bundleId: "phase5-bundle",
    termMonths: 3,
    baseAmountMinor: 404700,
    discountMinor: 0,
    amountMinor: 404700,
    currency: "INR",
    livemode: false,
    notes: {
      bundle_subjects: ["physics", "chemistry", "mathematics", "biology"],
    },
  });
  const attached = await attachRazorpayOrderId(order.id, `order_phase5_${order.id}`);
  assert.ok(attached);

  const result = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: attached.razorpayOrderId,
    razorpayPaymentId: `pay_phase5_bundle_${order.id}`,
    amountMinor: attached.amountMinor,
    currency: "INR",
  });

  assert.equal(result.grants.length, 4);
  const rows = await rawPool().query(
    `SELECT subject FROM entitlements.subject_grants
      WHERE order_id = $1 AND source = 'paid_order' AND status = 'active'
      ORDER BY subject`,
    [order.id],
  );
  assert.deepEqual(rows.rows.map((row) => row.subject), ["biology", "chemistry", "mathematics", "physics"]);
});

test("max_redemptions=1 admits one concurrent reservation", opts, async () => {
  const { reserveCoupon, releaseCouponReservation } = await import("@/server/pricing/coupons-service");
  const attempts = await Promise.allSettled([
    reserveCoupon({
      code: couponCode,
      userId: makeId("coupon_user_a"),
      subject: "physics",
      targetKind: "subject",
      orderId: makeId("order_a"),
      amountDiscountedMinor: 24950,
    }),
    reserveCoupon({
      code: couponCode,
      userId: makeId("coupon_user_b"),
      subject: "physics",
      targetKind: "subject",
      orderId: makeId("order_b"),
      amountDiscountedMinor: 24950,
    }),
  ]);
  const fulfilled = attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveCoupon>>> => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt) => attempt.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(String((rejected[0] as PromiseRejectedResult).reason), /redemption limit/i);

  const winner = fulfilled[0].value;
  await releaseCouponReservation({
    code: winner.code,
    userId: winner.userId,
    orderId: winner.orderId,
  });
  const count = await rawPool().query<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM pricing.coupon_redemptions WHERE code = $1 AND state = 'reserved'`,
    [couponCode],
  );
  assert.equal(Number(count.rows[0]?.n ?? 0), 0);
});

test("cleanup", opts, async () => {
  await rawPool().query(`DELETE FROM pricing.coupon_redemptions WHERE code = $1`, [couponCode]);
  await rawPool().query(`DELETE FROM pricing.coupons WHERE code = $1`, [couponCode]);
  if (userId) await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  await closePool();
});
