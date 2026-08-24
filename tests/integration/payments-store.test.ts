/**
 * Phase 1 — payments ledger store, against a real Postgres.
 *
 * These are the invariants the money depends on. Each maps to an edge-case row
 * in V1/RAZORPAY_PAYMENTS_PLAN.md §7:
 *   E1  duplicate idempotency key cannot create two orders
 *   E21 duplicate webhook delivery is recorded once
 *   E26 the same payment arriving twice converges on one row
 *   E36 duplicate outbox dispatch cannot send two emails
 *   E38 a poisoned outbox row parks instead of retrying forever
 *   E43 a late failure event cannot walk a PAID order backwards
 *
 * Skipped when USER_DATABASE_URL is not set, like the other integration tests.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";
import {
  MAX_EVENT_ATTEMPTS,
  MAX_OUTBOX_ATTEMPTS,
  attachRazorpayOrderId,
  claimDueEvents,
  claimDueOutboxRows,
  claimOutboxRow,
  enqueueOutbox,
  getEvent,
  getOrderById,
  getOrderByIdempotencyKey,
  getOrderByRazorpayId,
  getPaymentById,
  getPaymentsBacklog,
  insertOrder,
  insertRefund,
  listUserOrders,
  markOutboxDone,
  markOutboxFailed,
  newOrderId,
  recordEvent,
  setEventStatus,
  setOrderStatus,
  upsertPayment,
} from "@/server/payments/payments-store";
import { ensurePaymentsSchema } from "@/server/payments/payments-schema";

const skip = !dbConfigured();
const opts = { skip: skip ? "USER_DATABASE_URL not set" : false };

let userId = "";

test("setup: schema + a user to own the orders", opts, async () => {
  await ensurePaymentsSchema();
  userId = makeId("user_pay");
  await rawPool().query(
    `INSERT INTO origin_users (id, email, name, password_hash, role)
     VALUES ($1, $2, 'Pay Tester', 'x', 'student') ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@example.com`],
  );
});

function baseOrder(over: Partial<Parameters<typeof insertOrder>[0]> = {}) {
  return {
    id: newOrderId(),
    userId,
    kind: "subject_term" as const,
    subject: "physics",
    termMonths: 1,
    baseAmountMinor: 49900,
    discountMinor: 0,
    amountMinor: 49900,
    livemode: false,
    ...over,
  };
}

test("an order is written BEFORE Razorpay, then the razorpay id is attached", opts, async () => {
  const order = await insertOrder(baseOrder());
  assert.equal(order.status, "created");
  assert.equal(order.razorpayOrderId, null);
  assert.equal(order.amountMinor, 49900);
  assert.equal(order.livemode, false);

  const rzpId = `order_${order.id}`;
  const attached = await attachRazorpayOrderId(order.id, rzpId);
  assert.equal(attached?.status, "attempted");
  assert.equal(attached?.razorpayOrderId, rzpId);

  assert.equal((await getOrderByRazorpayId(rzpId))?.id, order.id);
  // Attaching twice is a no-op — the guard is `status = 'created'`.
  assert.equal(await attachRazorpayOrderId(order.id, "order_other"), null);
  assert.equal((await getOrderById(order.id))?.razorpayOrderId, rzpId);
});

test("E1: the same idempotency key cannot create a second order for one user", opts, async () => {
  const key = `idem_${Math.random().toString(36).slice(2)}`;
  const first = await insertOrder(baseOrder({ idempotencyKey: key }));
  await assert.rejects(
    () => insertOrder(baseOrder({ idempotencyKey: key })),
    /duplicate key value|uq_payments_orders_idem/,
  );
  assert.equal((await getOrderByIdempotencyKey(userId, key))?.id, first.id);

  // The SAME key belonging to a DIFFERENT user is unrelated and must be allowed.
  const other = makeId("user_pay");
  await rawPool().query(
    `INSERT INTO origin_users (id, email, name, password_hash, role)
     VALUES ($1, $2, 'Other', 'x', 'student') ON CONFLICT (id) DO NOTHING`,
    [other, `${other}@example.com`],
  );
  const cross = await insertOrder({ ...baseOrder({ idempotencyKey: key }), userId: other });
  assert.equal(cross.idempotencyKey, key);
});

test("E43: a late failure event cannot walk a PAID order backwards", opts, async () => {
  const order = await insertOrder(baseOrder());
  assert.equal((await setOrderStatus(order.id, "paid"))?.status, "paid");
  const paidAt = (await getOrderById(order.id))!.paidAt;
  assert.ok(paidAt, "paid_at is stamped");

  // The guard returns null (no row updated) rather than silently downgrading.
  assert.equal(await setOrderStatus(order.id, "failed", { failureReason: "late" }), null);
  assert.equal(await setOrderStatus(order.id, "expired"), null);
  assert.equal((await getOrderById(order.id))?.status, "paid");

  // Refund states remain reachable from paid, and paid_at is not re-stamped.
  assert.equal((await setOrderStatus(order.id, "partially_refunded"))?.status, "partially_refunded");
  const refunded = await setOrderStatus(order.id, "refunded");
  assert.equal(refunded?.status, "refunded");
  assert.equal(refunded?.paidAt, paidAt, "paid_at must not move");
});

test("E26: the same payment arriving twice converges on one row", opts, async () => {
  const order = await insertOrder(baseOrder());
  const payId = `pay_${order.id}`;
  await upsertPayment({
    razorpayPaymentId: payId,
    orderId: order.id,
    userId,
    amountMinor: 49900,
    status: "authorized",
    livemode: false,
  });
  // A later `payment.captured` for the same id enriches rather than duplicates.
  await upsertPayment({
    razorpayPaymentId: payId,
    amountMinor: 49900,
    status: "captured",
    method: "upi",
    feeMinor: 1180,
    capturedAt: new Date(),
    livemode: false,
  });

  const stored = await getPaymentById(payId);
  assert.equal(stored?.status, "captured");
  assert.equal(stored?.method, "upi");
  assert.equal(stored?.feeMinor, 1180);
  // COALESCE must preserve the linkage the first write established.
  assert.equal(stored?.orderId, order.id, "order link preserved by the second write");
  assert.equal(stored?.userId, userId, "user link preserved by the second write");

  const { rows } = await rawPool().query(
    `SELECT count(*)::int n FROM payments.payments WHERE razorpay_payment_id = $1`,
    [payId],
  );
  assert.equal(rows[0].n, 1, "exactly one payment row");
});

test("refunds are idempotent and the running total never exceeds the payment", opts, async () => {
  const order = await insertOrder(baseOrder());
  const payId = `pay_r_${order.id}`;
  await upsertPayment({
    razorpayPaymentId: payId,
    orderId: order.id,
    userId,
    amountMinor: 49900,
    status: "captured",
    livemode: false,
  });

  const first = await insertRefund({
    razorpayRefundId: `rfnd_a_${order.id}`,
    razorpayPaymentId: payId,
    amountMinor: 10000,
    isFull: false,
    status: "processed",
    livemode: false,
  });
  assert.equal(first.inserted, true);
  assert.equal((await getPaymentById(payId))?.amountRefundedMinor, 10000);

  // A duplicate refund webhook must NOT double-count.
  const dup = await insertRefund({
    razorpayRefundId: `rfnd_a_${order.id}`,
    razorpayPaymentId: payId,
    amountMinor: 10000,
    isFull: false,
    status: "processed",
    livemode: false,
  });
  assert.equal(dup.inserted, false);
  assert.equal((await getPaymentById(payId))?.amountRefundedMinor, 10000, "still 10000");

  // An over-refund is clamped at the captured amount rather than going negative.
  await insertRefund({
    razorpayRefundId: `rfnd_b_${order.id}`,
    razorpayPaymentId: payId,
    amountMinor: 999999,
    isFull: true,
    status: "processed",
    livemode: false,
  });
  assert.equal((await getPaymentById(payId))?.amountRefundedMinor, 49900, "clamped to amount_minor");
});

test("E21: a re-delivered webhook event is recorded once, payload retained", opts, async () => {
  const eventId = `evt_${Math.random().toString(36).slice(2)}`;
  const payload = { event: "order.paid", payload: { order: { entity: { id: "order_x" } } } };

  assert.equal((await recordEvent({ eventId, eventType: "order.paid", entityId: "order_x", payload, livemode: false })).isNew, true);
  assert.equal((await recordEvent({ eventId, eventType: "order.paid", entityId: "order_x", payload, livemode: false })).isNew, false);

  const stored = await getEvent(eventId);
  assert.equal(stored?.status, "pending");
  assert.equal(stored?.attempts, 0);
  // The raw payload must survive so a processing bug is replayable (gap G15).
  assert.deepEqual(stored?.payload, payload);
});

test("event status transitions record attempts and schedule the retry", opts, async () => {
  const eventId = `evt_${Math.random().toString(36).slice(2)}`;
  await recordEvent({ eventId, eventType: "payment.captured", entityId: null, payload: {}, livemode: false });

  await setEventStatus(eventId, "failed", { error: "boom", retryInSeconds: 60 });
  const failed = await getEvent(eventId);
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "boom");
  // Recording an OUTCOME must not touch `attempts` — the claim burns it, so a
  // drain that dies mid-event is still counted (see the crash test below).
  assert.equal(failed?.attempts, 0, "outcome does not burn an attempt");
  assert.ok(new Date(failed!.nextAttemptAt).getTime() > Date.now() + 30_000, "backoff applied");

  await setEventStatus(eventId, "processed");
  const done = await getEvent(eventId);
  assert.equal(done?.status, "processed");
  assert.ok(done?.processedAt, "processed_at stamped");
});

test("claimDueEvents leases a due event and defers it from a concurrent drain", opts, async () => {
  const eventId = `evt_claim_${Math.random().toString(36).slice(2)}`;
  await recordEvent({ eventId, eventType: "order.paid", entityId: null, payload: {}, livemode: false });

  const claimed = await claimDueEvents(50);
  assert.ok(claimed.some((e) => e.eventId === eventId), "our event was claimed");

  // A second drain running immediately must not re-claim it — the lease pushed
  // next_attempt_at forward, which is what keeps overlapping crons safe.
  const again = await claimDueEvents(50);
  assert.equal(again.some((e) => e.eventId === eventId), false, "not re-claimed while leased");

  await setEventStatus(eventId, "processed");
});

test("E36: an outbox row can only be claimed once — duplicate delivery sends nothing", opts, async () => {
  const id = await enqueueOutbox({ kind: "receipt_email", payload: { to: "a@b.c" } });

  const first = await claimOutboxRow(id);
  assert.ok(first, "first delivery claims the row");
  assert.equal(first?.attempts, 1);

  // QStash re-delivering the same dedup id finds it already processing.
  assert.equal(await claimOutboxRow(id), null, "second delivery is a no-op");

  await markOutboxDone(id, "qstash");
  assert.equal(await claimOutboxRow(id), null, "a done row is never re-claimed");
});

test("E38: a permanently failing outbox row parks after MAX_OUTBOX_ATTEMPTS", opts, async () => {
  const id = await enqueueOutbox({ kind: "receipt_email", payload: {} });

  for (let i = 1; i <= MAX_OUTBOX_ATTEMPTS; i += 1) {
    const claimed = await claimOutboxRow(id);
    assert.ok(claimed, `attempt ${i} claims`);
    await markOutboxFailed(id, `smtp down (${i})`, 0);
  }
  // The final failure parks it; the drain must stop picking it up.
  const parked = await claimDueOutboxRows(100);
  assert.equal(parked.some((r) => r.id === id), false, "parked row is not re-claimed by the drain");

  const { rows } = await rawPool().query(`SELECT status, attempts FROM payments.outbox WHERE id = $1`, [id]);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].attempts, MAX_OUTBOX_ATTEMPTS);
});

test("the backlog snapshot counts what the health endpoint reports on", opts, async () => {
  const backlog = await getPaymentsBacklog();
  assert.equal(typeof backlog.pendingEvents, "number");
  assert.equal(typeof backlog.failedOutbox, "number");
  assert.equal(typeof backlog.stuckOrders, "number");
  assert.ok(backlog.failedOutbox >= 1, "the parked row from the previous test is counted");
  assert.ok(backlog.lastWebhookAt, "lastWebhookAt is populated once any event exists");
});

test("listUserOrders returns this user's orders newest-first", opts, async () => {
  const orders = await listUserOrders(userId, 100);
  assert.ok(orders.length >= 3);
  assert.ok(orders.every((o) => o.userId === userId), "no cross-user leakage");
  for (let i = 1; i < orders.length; i += 1) {
    assert.ok(
      new Date(orders[i - 1].createdAt).getTime() >= new Date(orders[i].createdAt).getTime(),
      "descending by created_at",
    );
  }
});

test("E40: a REFUNDED order can never be resurrected to paid", opts, async () => {
  const order = await insertOrder(baseOrder());
  await setOrderStatus(order.id, "paid");
  await setOrderStatus(order.id, "refunded");
  assert.equal((await getOrderById(order.id))?.status, "refunded");

  // Two different webhooks describe one payment (order.paid + payment.captured).
  // If the refund lands between them, the straggler must not re-grant access.
  assert.equal(await setOrderStatus(order.id, "paid"), null, "guarded, no row updated");
  assert.equal((await getOrderById(order.id))?.status, "refunded");

  // A partial refund may still escalate to a full refund.
  const partial = await insertOrder(baseOrder());
  await setOrderStatus(partial.id, "paid");
  await setOrderStatus(partial.id, "partially_refunded");
  assert.equal((await setOrderStatus(partial.id, "refunded"))?.status, "refunded");
  // ...but never back to paid.
  assert.equal(await setOrderStatus(partial.id, "paid"), null);
});

test("a drain that crashes mid-event still burns an attempt", opts, async () => {
  const eventId = `evt_crash_${Math.random().toString(36).slice(2)}`;
  await recordEvent({ eventId, eventType: "order.paid", entityId: null, payload: {}, livemode: false });

  // Claim, then the process dies before any outcome is recorded.
  await claimDueEvents(100);
  assert.equal(
    (await getEvent(eventId))?.attempts,
    1,
    "an event that kills the drain must still count toward MAX_EVENT_ATTEMPTS",
  );

  // Once the cap is reached the event stops being claimed and is left visible
  // in the health backlog for a human, instead of crash-looping forever.
  await rawPool().query(
    `UPDATE payments.events SET attempts = $2, status = 'failed', next_attempt_at = NOW() WHERE event_id = $1`,
    [eventId, MAX_EVENT_ATTEMPTS],
  );
  const claimed = await claimDueEvents(100);
  assert.equal(claimed.some((e) => e.eventId === eventId), false, "capped event is not re-claimed");
});

test("teardown: close the pool", opts, async () => {
  await closePool();
});
