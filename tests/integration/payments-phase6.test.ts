/**
 * Phase 6 acceptance — Rail B + Connect folded onto the unified payments ledger,
 * and institute one-time orders (G16) wired to real Razorpay orders via Rail A.
 *
 * Everything here runs against a real Postgres. Razorpay itself is never called:
 * subscriptions are seeded as `created` rows (exactly as checkout would leave
 * them) and the webhook bodies are hand-built, which is what the production
 * handlers actually receive.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";
process.env.TEACHER_LAUNCH_PAYMENTS = "1";

import { intakeConnectWebhook } from "@/server/connect/enrollment-subscription-service";
import { createEnrollmentSubscription } from "@/server/connect/enrollment-subscriptions-store";
import { drainConnectJobs } from "@/server/connect/connect-jobs";
import { applyPaymentSuccess, createCheckoutOrder, resolveOrderAmount } from "@/server/payments/orders-service";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";
import { claimDueEvents, getEvent, getPaymentById } from "@/server/payments/payments-store";
import { dispatchOutbox } from "@/server/payments/outbox";
import { processSubscriptionWebhook } from "@/server/subscriptions/subscriptions-service";
import { upsertCreatedSubscription, getSubscriptionByRazorpayId } from "@/server/subscriptions/subscriptions-store";
import { isStudentInBatch } from "@/server/workspaces/batches";
import { getEnrollment } from "@/server/workspaces/enrollments";
import { updateOffering } from "@/server/workspaces/marketplace-store";
import { setOfferingPlanId } from "@/server/connect/enrollment-subscriptions-store";
import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };

const SECOND = 1;
const nowSeconds = () => Math.floor(Date.now() / 1000);

let userId = "";

/** No-op mail/notification so the outbox can be dispatched without SES. */
const silentDeps = {
  sendEmail: async () => ({ success: true as const, messageId: "test" }),
  createNotification: async () => undefined,
};

function subscriptionEvent(input: {
  event: string;
  subscriptionId: string;
  createdAt: number;
  currentEnd?: number | null;
  payment?: Record<string, unknown> | null;
}) {
  return {
    event: input.event,
    created_at: input.createdAt,
    payload: {
      subscription: {
        entity: {
          id: input.subscriptionId,
          status: "active",
          ...(input.currentEnd == null ? {} : { current_end: input.currentEnd }),
        },
      },
      ...(input.payment ? { payment: { entity: input.payment } } : {}),
    },
  };
}

function chargeEntity(id: string, amountMinor = 49900) {
  return {
    id,
    amount: amountMinor,
    currency: "INR",
    method: "upi",
    status: "captured",
    invoice_id: `inv_${id}`,
    fee: 1180,
    tax: 180,
    created_at: nowSeconds(),
  };
}

async function seedSubscription(subject: "physics" | "chemistry" | "biology" | "mathematics") {
  const razorpaySubscriptionId = makeId("sub_rzp");
  await upsertCreatedSubscription({
    userId,
    subject,
    razorpayPlanId: "plan_test",
    razorpaySubscriptionId,
    shortUrl: null,
    amountMinor: 49900,
  });
  return razorpaySubscriptionId;
}

test("setup: payments schema + an isolated student", opts, async () => {
  await ensurePaymentsAndGrantSchema();
  userId = makeId("user_p6");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, password_hash, role)
     VALUES ($1, 'Phase 6 Tester', $2, 'test-no-login', 'student')`,
    [userId, `${userId}@example.test`],
  );
});

// ── Rail B → unified ledger ──────────────────────────────────────────────────

test("a subscription lifecycle event is mirrored into payments.events and settled", opts, async () => {
  const subId = await seedSubscription("physics");
  const eventId = makeId("evt");
  const result = await processSubscriptionWebhook(
    eventId,
    subscriptionEvent({
      event: "subscription.activated",
      subscriptionId: subId,
      createdAt: nowSeconds(),
      currentEnd: nowSeconds() + 30 * 24 * 3600,
    }),
  );
  assert.equal(result.processed, true);

  const event = await getEvent(eventId);
  assert.ok(event, "the raw payload must be retained for replay (plan G15)");
  assert.equal(event?.eventType, "subscription.activated");
  assert.equal(event?.entityId, subId);
  // Never left pending: the Rail-A events drain has no handler for this shape.
  assert.equal(event?.status, "processed");
  assert.deepEqual(
    (event?.payload as { payload?: { subscription?: { entity?: { id?: string } } } })?.payload?.subscription?.entity?.id,
    subId,
  );
});

test("subscription.charged ledgers the invoice and enqueues exactly one receipt", opts, async () => {
  const subId = await seedSubscription("chemistry");
  const paymentId = makeId("pay_rzp");
  const body = subscriptionEvent({
    event: "subscription.charged",
    subscriptionId: subId,
    createdAt: nowSeconds(),
    currentEnd: nowSeconds() + 30 * 24 * 3600,
    payment: chargeEntity(paymentId),
  });

  await processSubscriptionWebhook(makeId("evt"), body);

  const payment = await getPaymentById(paymentId);
  assert.ok(payment, "a recurring charge must land in the money ledger");
  assert.equal(payment?.subscriptionId, subId);
  assert.equal(payment?.orderId, null, "Rail B charges have no Rail A order");
  assert.equal(payment?.userId, userId);
  assert.equal(payment?.amountMinor, 49900);
  assert.equal(payment?.status, "captured");
  assert.equal(payment?.feeMinor, 1180);
  assert.equal(payment?.razorpayInvoiceId, `inv_${paymentId}`);

  const outbox = await rawPool().query(
    `SELECT id, kind FROM payments.outbox WHERE payload->>'paymentId' = $1`,
    [paymentId],
  );
  assert.equal(outbox.rowCount, 1);
  assert.equal(outbox.rows[0].kind, "receipt_email");

  // A redelivery with a DIFFERENT event id (Razorpay's actual retry behaviour)
  // must not produce a second payment row or a second receipt.
  await processSubscriptionWebhook(makeId("evt"), body);
  const payments = await rawPool().query(
    `SELECT count(*)::int AS n FROM payments.payments WHERE razorpay_payment_id = $1`,
    [paymentId],
  );
  assert.equal(payments.rows[0].n, 1);
  const outboxAgain = await rawPool().query(
    `SELECT count(*)::int AS n FROM payments.outbox WHERE payload->>'paymentId' = $1`,
    [paymentId],
  );
  assert.equal(outboxAgain.rows[0].n, 1);
});

test("E27: a stale halted event delivered after a charge does not revoke access", opts, async () => {
  const subId = await seedSubscription("biology");
  const base = nowSeconds();

  await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.charged",
      subscriptionId: subId,
      createdAt: base + 100,
      currentEnd: base + 30 * 24 * 3600,
      payment: chargeEntity(makeId("pay_rzp")),
    }),
  );
  const afterCharge = await getSubscriptionByRazorpayId(subId);
  assert.equal(afterCharge?.status, "active");

  // Razorpay redelivers an OLDER halted event after the newer charge landed.
  const stale = await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.halted",
      subscriptionId: subId,
      createdAt: base + SECOND,
    }),
  );
  assert.deepEqual(stale, { processed: false, reason: "stale" });

  const afterStale = await getSubscriptionByRazorpayId(subId);
  assert.equal(afterStale?.status, "active", "an older event must never walk the status backwards");
  assert.equal(afterStale?.currentPeriodEnd, afterCharge?.currentPeriodEnd);
});

test("E27: a newer lapse event still applies, and the period end never shortens", opts, async () => {
  const subId = await seedSubscription("mathematics");
  const base = nowSeconds();
  const longEnd = base + 60 * 24 * 3600;

  await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.charged",
      subscriptionId: subId,
      createdAt: base + 100,
      currentEnd: longEnd,
      payment: chargeEntity(makeId("pay_rzp")),
    }),
  );

  // A LATER halted event is real state and must apply.
  const applied = await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({ event: "subscription.halted", subscriptionId: subId, createdAt: base + 200 }),
  );
  assert.equal(applied.processed, true);
  const halted = await getSubscriptionByRazorpayId(subId);
  assert.equal(halted?.status, "halted");
  assert.equal(
    new Date(halted!.currentPeriodEnd!).getTime(),
    longEnd * 1000,
    "a lapse keeps paid-for access to its natural expiry (plan E45)",
  );

  // A later charge that reports a SHORTER period must not shrink it.
  await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.charged",
      subscriptionId: subId,
      createdAt: base + 300,
      currentEnd: base + 5 * 24 * 3600,
      payment: chargeEntity(makeId("pay_rzp")),
    }),
  );
  const after = await getSubscriptionByRazorpayId(subId);
  assert.equal(new Date(after!.currentPeriodEnd!).getTime(), longEnd * 1000);
});

test("a charge for an unknown subscription is still ledgered, unattributed", opts, async () => {
  const orphanSub = makeId("sub_unknown");
  const paymentId = makeId("pay_rzp");
  const eventId = makeId("evt");

  const result = await processSubscriptionWebhook(
    eventId,
    subscriptionEvent({
      event: "subscription.charged",
      subscriptionId: orphanSub,
      createdAt: nowSeconds(),
      payment: chargeEntity(paymentId),
    }),
  );
  assert.deepEqual(result, { processed: false, reason: "unknown_subscription" });

  const payment = await getPaymentById(paymentId);
  assert.ok(payment, "money that arrived must never be discarded (plan E32)");
  assert.equal(payment?.userId, null);
  assert.equal(payment?.subscriptionId, orphanSub);

  const event = await getEvent(eventId);
  assert.equal(event?.status, "orphaned");

  // With no user there is nobody to mail, so no receipt is queued.
  const outbox = await rawPool().query(
    `SELECT count(*)::int AS n FROM payments.outbox WHERE payload->>'paymentId' = $1`,
    [paymentId],
  );
  assert.equal(outbox.rows[0].n, 0);
});

test("the legacy subscriptions ledger still owns duplicate suppression", opts, async () => {
  const subId = await seedSubscription("physics");
  const eventId = makeId("evt");
  const body = subscriptionEvent({
    event: "subscription.activated",
    subscriptionId: subId,
    createdAt: nowSeconds(),
    currentEnd: nowSeconds() + 30 * 24 * 3600,
  });
  const first = await processSubscriptionWebhook(eventId, body);
  assert.equal(first.processed, true);
  const second = await processSubscriptionWebhook(eventId, body);
  assert.deepEqual(second, { processed: false, reason: "duplicate" });
});

test("the Rail-A events drain never claims a subscription event", opts, async () => {
  // Mirrored subscription events exist for replayability only: the recurring
  // rails apply them, and Razorpay's redelivery is their retry authority. If
  // the drain claimed one it would find no handler, burn its attempts and mark
  // it ignored — erasing the failure record the backlog is meant to surface.
  const subId = makeId("sub_drain");
  const eventId = makeId("evt");
  await rawPool().query(
    `INSERT INTO payments.events (event_id, event_type, entity_id, payload, status, livemode)
     VALUES ($1, 'subscription.charged', $2, '{}'::jsonb, 'pending', false)`,
    [eventId, subId],
  );
  const railAEventId = makeId("evt");
  await rawPool().query(
    `INSERT INTO payments.events (event_id, event_type, entity_id, payload, status, livemode)
     VALUES ($1, 'payment.captured', $2, '{}'::jsonb, 'pending', false)`,
    [railAEventId, makeId("pay")],
  );

  const claimed = await claimDueEvents(100);
  const ids = claimed.map((event) => event.eventId);
  assert.equal(ids.includes(eventId), false, "a subscription event must not be claimable");
  assert.equal(ids.includes(railAEventId), true, "a Rail A event must still be claimed");

  await rawPool().query(`DELETE FROM payments.events WHERE event_id = ANY($1)`, [
    [eventId, railAEventId],
  ]);
});

test("re-subscribing clears the ordering fence so the new mandate's events apply", opts, async () => {
  const first = await seedSubscription("physics");
  const base = nowSeconds();
  await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.charged",
      subscriptionId: first,
      createdAt: base + 10_000,
      currentEnd: base + 30 * 24 * 3600,
      payment: chargeEntity(makeId("pay_rzp")),
    }),
  );

  // The student cancels and re-subscribes: a brand new Razorpay mandate on the
  // same (user, subject) row. Its first webhook may legitimately carry an
  // EARLIER event time than the old mandate's last one.
  const second = await seedSubscription("physics");
  const applied = await processSubscriptionWebhook(
    makeId("evt"),
    subscriptionEvent({
      event: "subscription.activated",
      subscriptionId: second,
      createdAt: base + 1,
      currentEnd: base + 60 * 24 * 3600,
    }),
  );
  assert.equal(applied.processed, true, "a new mandate must not inherit the old fence");
  const row = await getSubscriptionByRazorpayId(second);
  assert.equal(row?.status, "active");
});

// ── Connect rail → unified ledger ────────────────────────────────────────────

test("connect: intake mirrors the event and the drain ledgers the charge", opts, async () => {
  const fx = await seedFixtures();
  try {
    const subId = makeId("sub_connect");
    await createEnrollmentSubscription({
      offeringId: fx.offeringId,
      workspaceId: fx.workspaceId,
      studentId: fx.studentId,
      targetBatchId: fx.batchId,
      razorpayPlanId: "plan_connect",
      razorpaySubscriptionId: subId,
      amountMinor: 99900,
      shortUrl: null,
    });

    const paymentId = makeId("pay_connect");
    const eventId = makeId("evt");
    const intake = await intakeConnectWebhook(
      eventId,
      subscriptionEvent({
        event: "subscription.charged",
        subscriptionId: subId,
        createdAt: nowSeconds(),
        currentEnd: nowSeconds() + 30 * 24 * 3600,
        payment: chargeEntity(paymentId, 99900),
      }),
    );
    assert.deepEqual(intake, { processed: true, enqueued: true });

    const event = await getEvent(eventId);
    assert.ok(event, "connect events must be replayable too");
    assert.equal(event?.status, "processed");

    // Intake is non-blocking: nothing is ledgered until the drain runs.
    assert.equal(await getPaymentById(paymentId), null);

    const drained = await drainConnectJobs(5);
    assert.ok(drained.completed >= 1);

    const payment = await getPaymentById(paymentId);
    assert.ok(payment);
    assert.equal(payment?.userId, fx.studentId);
    assert.equal(payment?.subscriptionId, subId);
    assert.equal(payment?.amountMinor, 99900);

    // The activation side effect still happened.
    const enrollment = await getEnrollment(fx.workspaceId, fx.studentId);
    assert.equal(enrollment?.status, "active");
    assert.equal(await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId), true);
  } finally {
    // enrollment_subscriptions FKs the offering, so it must go before cleanup().
    await rawPool().query(`DELETE FROM commerce.enrollment_subscriptions WHERE workspace_id = $1`, [
      fx.workspaceId,
    ]);
    await cleanup(fx);
  }
});

test("connect E27: a stale event does not re-enrol a lapsed student", opts, async () => {
  const fx = await seedFixtures();
  try {
    const subId = makeId("sub_connect");
    const base = nowSeconds();
    await createEnrollmentSubscription({
      offeringId: fx.offeringId,
      workspaceId: fx.workspaceId,
      studentId: fx.studentId,
      targetBatchId: fx.batchId,
      razorpayPlanId: "plan_connect",
      razorpaySubscriptionId: subId,
      amountMinor: 99900,
      shortUrl: null,
    });

    await intakeConnectWebhook(
      makeId("evt"),
      subscriptionEvent({ event: "subscription.cancelled", subscriptionId: subId, createdAt: base + 200 }),
    );
    await drainConnectJobs(5);

    // An OLDER activation redelivered after the cancellation.
    await intakeConnectWebhook(
      makeId("evt"),
      subscriptionEvent({
        event: "subscription.activated",
        subscriptionId: subId,
        createdAt: base + SECOND,
        currentEnd: base + 30 * 24 * 3600,
      }),
    );
    await drainConnectJobs(5);

    const row = await rawPool().query(
      `SELECT status FROM commerce.enrollment_subscriptions WHERE razorpay_subscription_id = $1`,
      [subId],
    );
    assert.equal(row.rows[0].status, "cancelled");
    assert.equal(
      await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId),
      false,
      "a stale activation must not put the student back in the batch",
    );
  } finally {
    await rawPool().query(`DELETE FROM commerce.enrollment_subscriptions WHERE workspace_id = $1`, [
      fx.workspaceId,
    ]);
    await cleanup(fx);
  }
});

// ── G16: institute one-time orders on Rail A ─────────────────────────────────

const stubRazorpay = {
  orders: {
    async create(input: { amount: number; currency: string }) {
      return { id: makeId("order_rzp"), amount: input.amount, currency: input.currency };
    },
  },
};

test("G16: an institute offering is priced from the offering row, never the client", opts, async () => {
  const fx = await seedFixtures();
  try {
    const resolved = await resolveOrderAmount({
      kind: "institute_offering",
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      termMonths: 1,
    });
    assert.equal(resolved.kind, "institute_offering");
    assert.equal(resolved.amountMinor, 99900);
    assert.equal(resolved.baseMinor, 99900);
    assert.equal(resolved.discountMinor, 0);
    assert.equal(resolved.termMonths, 1, "an enrolment fee is not on the term ladder");
    assert.equal(resolved.workspaceId, fx.workspaceId);
    assert.equal(resolved.offeringId, fx.offeringId);
  } finally {
    await cleanup(fx);
  }
});

test("G16: checkout opens the commerce order and capture enrols the student", opts, async () => {
  const fx = await seedFixtures();
  try {
    const checkout = await createCheckoutOrder({
      userId: fx.studentId,
      kind: "institute_offering",
      subject: "",
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      termMonths: 1,
      idempotencyKey: makeId("idem"),
      razorpayClient: stubRazorpay,
      keyId: "rzp_test_key",
    });
    assert.equal(checkout.amountMinor, 99900);
    assert.ok(checkout.razorpayOrderId);

    const enrollmentOrderId = checkout.order.notes.enrollment_order_id as string;
    assert.ok(enrollmentOrderId, "the money order must point at the commerce order it pays for");
    const before = await rawPool().query(
      `SELECT status FROM commerce.enrollment_orders WHERE id = $1`,
      [enrollmentOrderId],
    );
    assert.equal(before.rows[0].status, "created", "no enrolment before the money arrives");

    const paymentId = makeId("pay_inst");
    const applied = await applyPaymentSuccess({
      orderId: checkout.orderId,
      razorpayPaymentId: paymentId,
      amountMinor: 99900,
      currency: "INR",
      method: "card",
    });
    assert.equal(applied.alreadyApplied, false);
    assert.deepEqual(applied.grants, [], "an institute purchase grants no subject entitlement");
    assert.equal(applied.order.status, "paid");

    // The enrolment is a transactional-outbox side effect, so it lands on drain.
    const dispatched = await dispatchOutbox(`institute_enrollment_${paymentId}`, "test", silentDeps);
    assert.equal(dispatched.status, "done");

    const after = await rawPool().query(
      `SELECT status, provider, provider_payment_id, enrollment_id
         FROM commerce.enrollment_orders WHERE id = $1`,
      [enrollmentOrderId],
    );
    assert.equal(after.rows[0].status, "paid");
    assert.equal(after.rows[0].provider, "razorpay");
    assert.equal(after.rows[0].provider_payment_id, paymentId);
    assert.ok(after.rows[0].enrollment_id);

    const enrollment = await getEnrollment(fx.workspaceId, fx.studentId);
    assert.equal(enrollment?.status, "active");
    assert.equal(await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId), true);

    // The student still gets a receipt, and only one.
    const receipts = await rawPool().query(
      `SELECT count(*)::int AS n FROM payments.outbox
        WHERE kind = 'receipt_email' AND payload->>'paymentId' = $1`,
      [paymentId],
    );
    assert.equal(receipts.rows[0].n, 1);

    // A second delivery of the same capture is a no-op on both ledgers.
    const replay = await applyPaymentSuccess({
      orderId: checkout.orderId,
      razorpayPaymentId: paymentId,
      amountMinor: 99900,
      currency: "INR",
    });
    assert.equal(replay.alreadyApplied, true);
    const orders = await rawPool().query(
      `SELECT count(*)::int AS n FROM commerce.enrollment_orders
        WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(orders.rows[0].n, 1);
  } finally {
    await cleanup(fx);
  }
});

test("G16: the enrolment outbox row is idempotent under a retried dispatch", opts, async () => {
  const fx = await seedFixtures();
  try {
    const checkout = await createCheckoutOrder({
      userId: fx.studentId,
      kind: "institute_offering",
      subject: "",
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      termMonths: 1,
      idempotencyKey: makeId("idem"),
      razorpayClient: stubRazorpay,
      keyId: "rzp_test_key",
    });
    const paymentId = makeId("pay_inst");
    await applyPaymentSuccess({
      orderId: checkout.orderId,
      razorpayPaymentId: paymentId,
      amountMinor: 99900,
      currency: "INR",
    });

    const first = await dispatchOutbox(`institute_enrollment_${paymentId}`, "test", silentDeps);
    assert.equal(first.status, "done");
    // Re-running a completed row is a claim miss, not a second enrolment.
    const second = await dispatchOutbox(`institute_enrollment_${paymentId}`, "test", silentDeps);
    assert.equal(second.status, "skipped");

    const enrollments = await rawPool().query(
      `SELECT count(*)::int AS n FROM app.workspace_student_enrollments
        WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(enrollments.rows[0].n, 1);
  } finally {
    await cleanup(fx);
  }
});

test("G16: coupons and recurring offerings are refused on the one-time rail", opts, async () => {
  const fx = await seedFixtures();
  try {
    await assert.rejects(
      () =>
        resolveOrderAmount({
          kind: "institute_offering",
          workspaceId: fx.workspaceId,
          offeringId: fx.offeringId,
          termMonths: 1,
          couponCode: "SAVE10",
          userId: fx.studentId,
        }),
      /Coupons do not apply to institute offerings/,
    );

    // A recurring (Flow-2) offering is identified by having a Razorpay plan, not
    // by billing_period alone — that column defaults to 'monthly' on every
    // legacy one-time offering.
    await setOfferingPlanId(fx.workspaceId, fx.offeringId, "plan_recurring");
    await assert.rejects(
      () =>
        resolveOrderAmount({
          kind: "institute_offering",
          workspaceId: fx.workspaceId,
          offeringId: fx.offeringId,
          termMonths: 1,
        }),
      /bills monthly/,
    );
  } finally {
    await cleanup(fx);
  }
});

test("G16: an archived offering cannot be bought", opts, async () => {
  const fx = await seedFixtures();
  try {
    await updateOffering(fx.workspaceId, fx.offeringId, { status: "archived" });
    await assert.rejects(
      () =>
        createCheckoutOrder({
          userId: fx.studentId,
          kind: "institute_offering",
          subject: "",
          workspaceId: fx.workspaceId,
          offeringId: fx.offeringId,
          termMonths: 1,
          idempotencyKey: makeId("idem"),
          razorpayClient: stubRazorpay,
        }),
      /not available for purchase/,
    );
  } finally {
    await cleanup(fx);
  }
});

test("teardown", opts, async () => {
  const pool = rawPool();
  await pool.query(`DELETE FROM payments.orders WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM subscriptions.user_subscriptions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  await closePool();
});
