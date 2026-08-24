/**
 * Phase 3 Rail-A service contract against Postgres.
 *
 * The suite deliberately stubs only Razorpay's `orders.create`; capture and
 * webhook application exercise the real payments ledger + entitlement tables.
 * It is safe on a developer machine without Postgres: every test is skipped
 * when USER_DATABASE_URL is absent, matching the other payment integrations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPaymentSuccess,
  createCheckoutOrder,
  PaymentGatewayError,
  processPaymentEvent,
} from "@/server/payments/orders-service";
import {
  attachRazorpayOrderId,
  getOrderById,
  getPaymentById,
  insertOrder,
  newOrderId,
} from "@/server/payments/payments-store";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";
import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };
let userId = "";

test("setup: payments + grants schemas and an isolated student", opts, async () => {
  await ensurePaymentsAndGrantSchema();
  userId = makeId("user_rail_a");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, password_hash, role)
     VALUES ($1, 'Rail A Tester', $2, 'test-only', 'student')`,
    [userId, `${userId}@example.test`],
  );
});

function baseOrder(over: Partial<Parameters<typeof insertOrder>[0]> = {}) {
  return {
    id: newOrderId(),
    userId,
    kind: "subject_term" as const,
    subject: "physics" as const,
    termMonths: 1,
    baseAmountMinor: 49900,
    discountMinor: 0,
    amountMinor: 49900,
    livemode: false,
    ...over,
  };
}

async function createAttachedOrder(over: Partial<Parameters<typeof insertOrder>[0]> = {}) {
  const order = await insertOrder(baseOrder(over));
  const attached = await attachRazorpayOrderId(order.id, `order_rzp_${order.id}`);
  assert.ok(attached);
  return attached;
}

test("checkout writes a local order first and wraps gateway errors as retryable", opts, async () => {
  const failingClient = {
    orders: {
      async create() {
        throw new Error("Razorpay timeout");
      },
    },
  };

  await assert.rejects(
    () =>
      createCheckoutOrder({
        userId,
        subject: "physics",
        termMonths: 1,
        idempotencyKey: makeId("idem_gateway"),
        razorpayClient: failingClient,
      }),
    (error: unknown) => error instanceof PaymentGatewayError && error.status === 503,
  );

  const failed = await rawPool().query(
    `SELECT status, failure_reason FROM payments.orders
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  assert.equal(failed.rows[0]?.status, "failed");
  assert.match(String(failed.rows[0]?.failure_reason), /Razorpay timeout/);
});

test("a gateway failure releases the checkout key for a fresh retry", opts, async () => {
  const idempotencyKey = makeId("idem_retry");
  const failingClient = {
    orders: {
      async create() {
        throw new Error("temporary gateway outage");
      },
    },
  };
  await assert.rejects(() => createCheckoutOrder({
    userId,
    subject: "chemistry",
    termMonths: 1,
    idempotencyKey,
    razorpayClient: failingClient,
  }), PaymentGatewayError);

  const successfulClient = {
    orders: {
      async create() {
        return { id: `order_retry_${idempotencyKey}` };
      },
    },
  };
  const retry = await createCheckoutOrder({
    userId,
    subject: "chemistry",
    termMonths: 1,
    idempotencyKey,
    razorpayClient: successfulClient,
  });
  assert.equal(retry.order.status, "attempted");
  assert.match(String(retry.razorpayOrderId), /order_retry_/);
  const failedRows = await rawPool().query(
    `SELECT status FROM payments.orders
      WHERE user_id = $1 AND subject = 'chemistry' AND status = 'failed'`,
    [userId],
  );
  assert.ok(failedRows.rows.length >= 1, "the failed attempt remains auditable");
});

test("capture grants the term, and duplicate webhook/verify delivery is a no-op", opts, async () => {
  const order = await createAttachedOrder({ termMonths: 3, baseAmountMinor: 134700, amountMinor: 134700 });
  const paymentId = `pay_capture_${order.id}`;
  const first = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: paymentId,
    amountMinor: order.amountMinor,
    currency: "INR",
    method: "upi",
  });
  assert.equal(first.alreadyApplied, false);
  assert.equal(first.grants.length, 1);
  assert.equal(first.order.status, "paid");

  const expiry = first.grants[0].expiresAt;
  const duplicate = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: paymentId,
    amountMinor: order.amountMinor,
    currency: "INR",
  });
  assert.equal(duplicate.alreadyApplied, true);
  assert.deepEqual(duplicate.grants, []);

  const storedPayment = await getPaymentById(paymentId);
  assert.equal(storedPayment?.status, "captured");
  const grants = await rawPool().query(
    `SELECT expires_at FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = 'physics' AND source = 'paid_order' AND status = 'active'`,
    [userId],
  );
  assert.equal(grants.rows.length, 1);
  assert.equal(new Date(grants.rows[0].expires_at).toISOString(), expiry);
});

test("order.paid followed by payment.captured converges on one payment and one grant", opts, async () => {
  const order = await createAttachedOrder();
  const paymentId = `pay_events_${order.id}`;
  const eventPayload = (event: string) => ({
    event,
    payload: {
      order: { entity: { id: order.razorpayOrderId } },
      payment: {
        entity: {
          id: paymentId,
          order_id: order.razorpayOrderId,
          amount: order.amountMinor,
          currency: "INR",
          method: "card",
        },
      },
    },
  });

  const first = await processPaymentEvent(eventPayload("order.paid"));
  assert.ok(first && "order" in first);
  assert.equal((first as { order: { status: string } }).order.status, "paid");
  const second = await processPaymentEvent(eventPayload("payment.captured"));
  assert.ok(second && "alreadyApplied" in second);
  assert.equal((second as { alreadyApplied: boolean }).alreadyApplied, true);

  const counts = await rawPool().query(
    `SELECT
       (SELECT count(*) FROM payments.payments WHERE razorpay_payment_id = $1)::int AS payments,
       (SELECT count(*) FROM entitlements.subject_grants
         WHERE user_id = $2 AND order_id = $3 AND source = 'paid_order')::int AS grants`,
    [paymentId, userId, order.id],
  );
  assert.equal(counts.rows[0].payments, 1);
  assert.equal(counts.rows[0].grants, 1);
});

test("wrong amount is rejected before a grant and leaves the order unpaid", opts, async () => {
  const order = await createAttachedOrder();
  await assert.rejects(
    () =>
      applyPaymentSuccess({
        orderId: order.id,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: `pay_bad_amount_${order.id}`,
        amountMinor: order.amountMinor - 100,
        currency: "INR",
      }),
    /does not match the order amount/,
  );
  assert.equal((await getOrderById(order.id))?.status, "attempted");
  const grants = await rawPool().query(
    `SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE order_id = $1`,
    [order.id],
  );
  assert.equal(grants.rows[0].n, 0);
});

test("payment failure marks an order failed; a later valid capture can still converge", opts, async () => {
  const order = await createAttachedOrder();
  const failed = await processPaymentEvent({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: `pay_failed_${order.id}`,
          order_id: order.razorpayOrderId,
          error_description: "insufficient funds",
        },
      },
    },
  });
  assert.ok(failed && "status" in failed);
  assert.equal((failed as { status: string }).status, "failed");

  const captured = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: `pay_retry_${order.id}`,
    amountMinor: order.amountMinor,
    currency: "INR",
  });
  assert.equal(captured.order.status, "paid");
  assert.equal(captured.grants.length, 1);
});

test("a zero-value ledger order can be settled without Razorpay", opts, async () => {
  const order = await createAttachedOrder({ baseAmountMinor: 0, amountMinor: 0 });
  const result = await applyPaymentSuccess({
    orderId: order.id,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: `coupon_${order.id}`,
    amountMinor: 0,
    currency: "INR",
    method: "coupon_full",
  });
  assert.equal(result.order.status, "paid");
  assert.equal(result.payment.amountMinor, 0);
  assert.equal(result.grants.length, 1);
});

test("cleanup", opts, async () => {
  if (userId) await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  await closePool();
});
