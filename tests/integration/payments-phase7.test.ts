/**
 * Phase 7 database acceptance: refunds, disputes, reconciliation, dunning, and
 * account-deletion cleanup. The gateway is fully stubbed and the suite skips
 * unless a disposable USER_DATABASE_URL is explicitly configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { deleteAccountForUser, tombstoneEmail } from "@/server/account-deletion";
import { ensureEnrollmentSubscriptionsSchema } from "@/server/connect/enrollment-subscriptions-schema";
import { paidTermExpiry } from "@/server/payments/grants";
import { applyPaymentSuccess, processPaymentEvent } from "@/server/payments/orders-service";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";
import {
  attachRazorpayOrderId,
  getOrderById,
  getPaymentById,
  insertOrder,
  newOrderId,
} from "@/server/payments/payments-store";
import {
  reconcilePayments,
  type RazorpayReconciliationAdapter,
} from "@/server/payments/reconciliation";
import type { RefundLifecycleResult } from "@/server/payments/refunds-service";
import { reserveCoupon } from "@/server/pricing/coupons-service";

import {
  cleanup,
  closePool,
  dbConfigured,
  makeId,
  rawPool,
  seedFixtures,
  type Fixtures,
} from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };
let fixtures: Fixtures;
let userId = "";
const paymentIds: string[] = [];
const refundIds: string[] = [];
const disputeIds: string[] = [];
let couponCode = "";
let connectSubscriptionId = "";

function paymentEvent(input: {
  event: "refund.created" | "refund.processed";
  refundId: string;
  paymentId: string;
  amountMinor: number;
}) {
  return {
    event: input.event,
    payload: {
      refund: {
        entity: {
          id: input.refundId,
          payment_id: input.paymentId,
          amount: input.amountMinor,
          status: "processed",
        },
      },
    },
  };
}

async function createAttachedOrder(input: {
  subject?: "physics" | "chemistry";
  termMonths?: number;
  amountMinor?: number;
  couponCode?: string | null;
  expiresAt?: Date | null;
}) {
  const amountMinor = input.amountMinor ?? 49900;
  const order = await insertOrder({
    id: newOrderId(),
    userId,
    kind: "subject_term",
    subject: input.subject ?? "physics",
    termMonths: input.termMonths ?? 1,
    baseAmountMinor: amountMinor,
    discountMinor: 0,
    amountMinor,
    couponCode: input.couponCode ?? null,
    livemode: false,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
  });
  const attached = await attachRazorpayOrderId(order.id, `order_phase7_${order.id}`);
  assert.ok(attached?.razorpayOrderId);
  return attached;
}

async function captureOrder(
  order: NonNullable<Awaited<ReturnType<typeof attachRazorpayOrderId>>>,
  paidAt: Date,
) {
  const paymentId = `pay_phase7_${order.id}`;
  paymentIds.push(paymentId);
  const result = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: paymentId,
    amountMinor: order.amountMinor,
    currency: "INR",
    method: "upi",
    now: paidAt,
  });
  assert.equal(result.alreadyApplied, false);
  return { paymentId, result };
}

test("setup: Phase 7 schemas and isolated commerce fixtures", opts, async () => {
  fixtures = await seedFixtures();
  userId = fixtures.studentId;
  await ensurePaymentsAndGrantSchema();
  await ensureEnrollmentSubscriptionsSchema();
});

test("partial then cumulative full refund is idempotent and revokes only its order", opts, async () => {
  const paidAtA = new Date(Date.now() - 2 * 60 * 1000);
  const paidAtB = new Date(Date.now() - 60 * 1000);
  const firstOrder = await createAttachedOrder({ termMonths: 1 });
  const first = await captureOrder(firstOrder, paidAtA);
  const secondOrder = await createAttachedOrder({ termMonths: 1 });
  const second = await captureOrder(secondOrder, paidAtB);

  const before = await rawPool().query(
    `SELECT order_id, expires_at FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = 'physics' AND source = 'paid_order' AND status = 'active'
      ORDER BY expires_at ASC`,
    [userId],
  );
  assert.equal(before.rows.length, 2);
  const secondBefore = before.rows.find((row) => row.order_id === secondOrder.id);
  assert.ok(secondBefore);

  const partialRefundId = makeId("rfnd_phase7_partial");
  refundIds.push(partialRefundId);
  const partial = await processPaymentEvent(paymentEvent({
    event: "refund.created",
    refundId: partialRefundId,
    paymentId: first.paymentId,
    amountMinor: 10000,
  })) as RefundLifecycleResult;
  assert.equal(partial.isFull, false);
  assert.equal(partial.amountRefundedMinor, 10000);
  assert.equal((await getOrderById(firstOrder.id))?.status, "partially_refunded");

  const duplicate = await processPaymentEvent(paymentEvent({
    event: "refund.processed",
    refundId: partialRefundId,
    paymentId: first.paymentId,
    amountMinor: 10000,
  })) as RefundLifecycleResult;
  assert.equal(duplicate.alreadyApplied, true);
  assert.equal(duplicate.amountRefundedMinor, 10000);

  const finalRefundId = makeId("rfnd_phase7_final");
  refundIds.push(finalRefundId);
  const full = await processPaymentEvent(paymentEvent({
    event: "refund.processed",
    refundId: finalRefundId,
    paymentId: first.paymentId,
    amountMinor: 39900,
  })) as RefundLifecycleResult;
  assert.equal(full.isFull, true);
  assert.equal(full.amountRefundedMinor, 49900);
  assert.equal(full.revokedGrantCount, 1);
  assert.equal((await getOrderById(firstOrder.id))?.status, "refunded");
  assert.equal((await getOrderById(secondOrder.id))?.status, "paid");

  const after = await rawPool().query(
    `SELECT g.order_id, g.status, g.expires_at, o.paid_at
       FROM entitlements.subject_grants g
       JOIN payments.orders o ON o.id = g.order_id
      WHERE g.user_id = $1 AND g.subject = 'physics' AND g.source = 'paid_order'
      ORDER BY g.order_id`,
    [userId],
  );
  assert.equal(after.rows.find((row) => row.order_id === firstOrder.id)?.status, "revoked");
  const remaining = after.rows.find((row) => row.order_id === secondOrder.id);
  assert.equal(remaining?.status, "active");
  assert.equal(
    new Date(remaining.expires_at).toISOString(),
    paidTermExpiry(null, 1, new Date(remaining.paid_at)).toISOString(),
  );
  assert.ok(
    new Date(remaining.expires_at).getTime() < new Date(secondBefore.expires_at).getTime(),
    "the surviving purchase is rebased instead of retaining the refunded term",
  );
  assert.equal((await getPaymentById(first.paymentId))?.amountRefundedMinor, 49900);

  const lateCapture = await applyPaymentSuccess({
    orderId: firstOrder.id,
    razorpayOrderId: firstOrder.razorpayOrderId,
    razorpayPaymentId: first.paymentId,
    amountMinor: firstOrder.amountMinor,
    currency: "INR",
    method: "upi",
    now: new Date(),
  });
  assert.equal(lateCapture.alreadyApplied, true);
  assert.equal(lateCapture.order.status, "refunded");
  assert.equal(lateCapture.payment.status, "refunded");
  assert.deepEqual(lateCapture.grants, []);

  const secondGrant = second.result.grants[0];
  assert.equal(secondGrant.orderId, secondOrder.id);
});

test("a dispute flags the payment while retaining the surviving entitlement", opts, async () => {
  const paymentId = paymentIds.at(-1)!;
  const disputeId = makeId("dsp_phase7");
  disputeIds.push(disputeId);
  const result = await processPaymentEvent({
    event: "payment.dispute.created",
    payload: {
      dispute: { entity: { id: disputeId, payment_id: paymentId, status: "open" } },
    },
  }) as { accessRevoked: false; alreadyApplied: boolean };
  assert.equal(result.accessRevoked, false);
  assert.equal(result.alreadyApplied, false);
  assert.equal((await getPaymentById(paymentId))?.disputeId, disputeId);
  const grants = await rawPool().query(
    `SELECT status FROM entitlements.subject_grants
      WHERE user_id = $1 AND order_id = (SELECT order_id FROM payments.payments WHERE razorpay_payment_id = $2)`,
    [userId, paymentId],
  );
  assert.deepEqual(grants.rows.map((row) => row.status), ["active"]);
});

test("reconciliation captures, waits on externally paid, expires abandoned, and emits Connect dunning", opts, async () => {
  const reconcileNow = new Date();
  const capturedOrder = await createAttachedOrder({ subject: "chemistry", expiresAt: new Date("2000-01-01T01:00:00.000Z") });
  const paidButLagging = await createAttachedOrder({ subject: "chemistry", expiresAt: new Date("2000-01-01T01:00:00.000Z") });
  const abandoned = await createAttachedOrder({ subject: "chemistry", expiresAt: new Date("2000-01-01T01:00:00.000Z") });
  for (const [index, order] of [capturedOrder, paidButLagging, abandoned].entries()) {
    await rawPool().query(
      `UPDATE payments.orders SET created_at = $2, updated_at = $2 WHERE id = $1`,
      [order.id, new Date(Date.UTC(1990, 0, 1, 0, index, 0))],
    );
  }

  connectSubscriptionId = makeId("esub_phase7_dunning");
  await rawPool().query(
    `INSERT INTO commerce.enrollment_subscriptions
       (id, offering_id, workspace_id, student_id, target_batch_id,
        razorpay_plan_id, razorpay_subscription_id, status, amount_minor,
        current_period_end, updated_at)
     VALUES ($1,$2,$3,$4,$5,'plan_phase7',$6,'pending',99900,$7,$8)`,
    [
      connectSubscriptionId,
      fixtures.offeringId,
      fixtures.workspaceId,
      userId,
      fixtures.batchId,
      `sub_phase7_${connectSubscriptionId}`,
      new Date(reconcileNow.getTime() + 30 * 24 * 60 * 60 * 1000),
      reconcileNow,
    ],
  );

  const capturedPaymentId = `pay_phase7_reconcile_${capturedOrder.id}`;
  paymentIds.push(capturedPaymentId);
  const statusByOrder = new Map<string, string>([
    [capturedOrder.razorpayOrderId!, "attempted"],
    [paidButLagging.razorpayOrderId!, "paid"],
    [abandoned.razorpayOrderId!, "attempted"],
  ]);
  const adapter: RazorpayReconciliationAdapter = {
    orders: {
      async fetch(orderId) {
        return { id: orderId, status: statusByOrder.get(orderId) ?? "paid" };
      },
      async fetchPayments(orderId) {
        if (orderId !== capturedOrder.razorpayOrderId) return { items: [] };
        return {
          items: [{
            id: capturedPaymentId,
            order_id: orderId,
            amount: capturedOrder.amountMinor,
            currency: "INR",
            status: "captured",
            method: "upi",
            created_at: Math.floor(reconcileNow.getTime() / 1000),
          }],
        };
      },
    },
  };

  const result = await reconcilePayments({ now: reconcileNow, limit: 200, adapter });
  assert.ok(result.orders.inspected >= 3);
  assert.ok(result.orders.captured >= 1);
  assert.ok(result.orders.expired >= 1);
  assert.ok(result.orders.waiting >= 1);
  assert.equal(result.orders.errors, 0);
  assert.equal((await getOrderById(capturedOrder.id))?.status, "paid");
  assert.equal((await getOrderById(paidButLagging.id))?.status, "attempted");
  assert.equal((await getOrderById(abandoned.id))?.status, "expired");

  const dunning = await rawPool().query(
    `SELECT kind, payload FROM payments.outbox WHERE id = $1`,
    [`payment_dunning_mandate_failed_connect_${connectSubscriptionId}_0`],
  );
  assert.equal(dunning.rows[0]?.kind, "dunning_email");
  assert.equal(dunning.rows[0]?.payload?.kind, "batch_subscription");
  assert.equal(dunning.rows[0]?.payload?.retryHref, "/connect");
});

test("account deletion expires open orders and releases their coupon reservations", opts, async () => {
  couponCode = `PH7_${Date.now().toString(36).toUpperCase()}`;
  await rawPool().query(
    `INSERT INTO pricing.coupons
       (code, kind, value, applies_to, max_redemptions, per_user_limit, active)
     VALUES ($1, 'flat', 1000, 'subject', 10, 1, TRUE)`,
    [couponCode],
  );
  const order = await createAttachedOrder({ couponCode });
  await reserveCoupon({
    code: couponCode,
    userId,
    subject: "physics",
    targetKind: "subject",
    orderId: order.id,
    amountDiscountedMinor: 1000,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const result = await deleteAccountForUser(userId);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((warning) => warning.includes(order.razorpayOrderId!)));
  assert.equal((await getOrderById(order.id))?.status, "expired");
  const reservation = await rawPool().query(
    `SELECT state FROM pricing.coupon_redemptions WHERE code = $1 AND order_id = $2`,
    [couponCode, order.id],
  );
  assert.equal(reservation.rows[0]?.state, "released");
  const coupon = await rawPool().query(`SELECT times_redeemed FROM pricing.coupons WHERE code = $1`, [couponCode]);
  assert.equal(Number(coupon.rows[0]?.times_redeemed), 0);
  const user = await rawPool().query(`SELECT name, email FROM origin_users WHERE id = $1`, [userId]);
  assert.equal(user.rows[0]?.name, "Deleted user");
  assert.equal(user.rows[0]?.email, tombstoneEmail(userId));
});

test("teardown: remove isolated Phase 7 fixtures", opts, async () => {
  if (connectSubscriptionId) {
    await rawPool().query(`DELETE FROM commerce.enrollment_subscriptions WHERE id = $1`, [connectSubscriptionId]);
  }
  if (refundIds.length > 0) {
    await rawPool().query(`DELETE FROM payments.refunds WHERE razorpay_refund_id = ANY($1::text[])`, [refundIds]);
  }
  if (paymentIds.length > 0) {
    await rawPool().query(`DELETE FROM payments.payments WHERE razorpay_payment_id = ANY($1::text[])`, [paymentIds]);
  }
  await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [userId]);
  await rawPool().query(`DELETE FROM payments.orders WHERE user_id = $1`, [userId]);
  await rawPool().query(
    `DELETE FROM payments.outbox
      WHERE payload->>'userId' = $1
         OR id LIKE ANY($2::text[])`,
    [
      userId,
      [
        ...refundIds.map((id) => `payment_refund_partial_${id}_%`),
        ...disputeIds.map((id) => `payment_dispute_${id}_%`),
        connectSubscriptionId
          ? `payment_dunning_mandate_failed_connect_${connectSubscriptionId}_%`
          : "phase7_no_match",
      ],
    ],
  );
  if (couponCode) {
    await rawPool().query(`DELETE FROM pricing.coupon_redemptions WHERE code = $1`, [couponCode]);
    await rawPool().query(`DELETE FROM pricing.coupons WHERE code = $1`, [couponCode]);
  }
  await cleanup(fixtures);
  await closePool();
});
