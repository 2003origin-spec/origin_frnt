/**
 * §7 edge-case ledger — the database-backed half.
 *
 * Each test is named for the E-number it holds. The map that proves every one
 * of the 56 has an owner lives in tests/unit/payments-edge-ledger.test.ts.
 *
 * Skips unless a disposable USER_DATABASE_URL is configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { drainPaymentEvents } from "@/server/payments/events-drain";
import {
  applyPaymentSuccess,
  createCheckoutOrder,
  processPaymentEvent,
  type RazorpayOrder,
  type RazorpayOrdersClient,
} from "@/server/payments/orders-service";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";
import {
  getEvent,
  getOrderById,
  recordEvent,
  setEventStatus,
} from "@/server/payments/payments-store";
import { setSubjectPrice } from "@/server/pricing/pricing-service";
import { validateCoupon } from "@/server/pricing/coupons-service";
import { invalidatePricingCache } from "@/server/payments/pricing-cache";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures, type Fixtures } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };

let fixtures: Fixtures;
let studentId = "";
const orderIds: string[] = [];
const paymentIds: string[] = [];
const eventIds: string[] = [];
let couponCode = "";
const clampCoupons: string[] = [];

/** Records every order it is asked to create, so E5's notes can be inspected. */
function stubRazorpay(): RazorpayOrdersClient & { created: Array<Record<string, unknown>> } {
  const created: Array<Record<string, unknown>> = [];
  return {
    created,
    orders: {
      async create(input): Promise<RazorpayOrder> {
        created.push(input as unknown as Record<string, unknown>);
        return { id: `order_edge_${created.length}_${Math.random().toString(36).slice(2, 8)}`, amount: input.amount, currency: input.currency, status: "created" };
      },
    },
  };
}

async function checkout(input: {
  subject?: string;
  kind?: "subject_term" | "bundle_term";
  bundleId?: string | null;
  termMonths?: number;
  couponCode?: string | null;
  client?: RazorpayOrdersClient;
}) {
  const result = await createCheckoutOrder({
    userId: studentId,
    subject: input.subject ?? "physics",
    kind: input.kind ?? "subject_term",
    bundleId: input.bundleId ?? null,
    termMonths: input.termMonths ?? 1,
    couponCode: input.couponCode ?? null,
    idempotencyKey: makeId("idem"),
    razorpayClient: input.client ?? stubRazorpay(),
    keyId: "rzp_test_edgecases",
  });
  orderIds.push(result.orderId);
  return result;
}

async function capture(result: Awaited<ReturnType<typeof checkout>>, overrides: { currency?: string } = {}) {
  const paymentId = `pay_edge_${result.orderId}`;
  paymentIds.push(paymentId);
  return applyPaymentSuccess({
    orderId: result.orderId,
    razorpayOrderId: result.razorpayOrderId,
    razorpayPaymentId: paymentId,
    amountMinor: result.amountMinor,
    currency: overrides.currency ?? "INR",
    method: "upi",
  });
}

test("setup: payments schemas, an isolated student, and a known subject price", opts, async () => {
  fixtures = await seedFixtures();
  studentId = fixtures.studentId;
  await ensurePaymentsAndGrantSchema();
  await setSubjectPrice({ subject: "physics", amountMinor: 49_900, adminUserId: "edge-cases" });
  await invalidatePricingCache();
});

test("E6/E7: the amount is resolved server-side and frozen onto the order", opts, async () => {
  // E6 is structural: CreateCheckoutOrderInput has no amount field at all, and
  // neither does the route's schema — there is nowhere for a client to put one.
  const opened = await checkout({ subject: "physics", termMonths: 1 });
  assert.equal(opened.amountMinor, 49_900, "the price came from the pricing table, not the caller");

  // E7: the admin re-prices while this checkout is open.
  await setSubjectPrice({ subject: "physics", amountMinor: 99_900, adminUserId: "edge-cases" });
  await invalidatePricingCache();

  const frozen = await getOrderById(opened.orderId);
  assert.equal(frozen?.amountMinor, 49_900, "the open order keeps the price the student was quoted");

  // Capturing at the ORIGINAL amount still settles; the new price is irrelevant
  // to an order already at the gateway.
  const applied = await capture(opened);
  assert.equal(applied.order.status, "paid");
  assert.equal(applied.payment.amountMinor, 49_900);

  // And a new checkout gets the new price.
  const next = await checkout({ subject: "physics", termMonths: 1 });
  assert.equal(next.amountMinor, 99_900);
  await setSubjectPrice({ subject: "physics", amountMinor: 49_900, adminUserId: "edge-cases" });
  await invalidatePricingCache();
});

test("E5: the Razorpay order carries origin_order_id so an orphan can be healed", opts, async () => {
  const client = stubRazorpay();
  const opened = await checkout({ subject: "chemistry", client });
  assert.equal(client.created.length, 1);
  const notes = client.created[0].notes as Record<string, unknown>;
  // Without this, a Razorpay order created just before our commit failed would
  // be unattributable and the reconcile cron could never match it back.
  assert.equal(notes.origin_order_id, opened.orderId);
  assert.equal(notes.origin_user_id, studentId);
  assert.equal(notes.origin_kind, "subject_term");
  assert.equal(client.created[0].amount, opened.amountMinor);
  assert.equal(client.created[0].currency, "INR");
});

test("E11: a capture in any currency but INR is refused before it touches the ledger", opts, async () => {
  const opened = await checkout({ subject: "biology" });
  await assert.rejects(() => capture(opened, { currency: "USD" }), /Only INR/);
  assert.notEqual((await getOrderById(opened.orderId))?.status, "paid");
  // The rejection is on the money path, not a display concern: the order is
  // still open and can be captured correctly afterwards.
  const applied = await capture(opened);
  assert.equal(applied.order.status, "paid");
});

test("E9: a bundle bought over an owned subject never loses the remaining time", opts, async () => {
  const solo = await checkout({ subject: "mathematics", termMonths: 1 });
  const soloApplied = await capture(solo);
  const soloExpiry = soloApplied.grants[0]?.expiresAt;
  assert.ok(soloExpiry, "the single-subject purchase granted mathematics");

  const bundle = await rawPool().query(
    `INSERT INTO pricing.bundle_offers (id, name, subjects, amount_minor, currency, active)
     VALUES ($1, 'Edge bundle', ARRAY['physics','chemistry','mathematics','biology']::text[], 149900, 'INR', TRUE)
     ON CONFLICT (id) DO UPDATE SET active = TRUE
     RETURNING id`,
    [makeId("bundle_edge")],
  );
  await invalidatePricingCache();
  const bundleId = String(bundle.rows[0].id);

  const opened = await checkout({ kind: "bundle_term", bundleId, subject: "physics", termMonths: 1 });
  const applied = await capture(opened);
  const bySubject = new Map(applied.grants.map((grant) => [grant.subject, grant.expiresAt]));
  assert.equal(bySubject.size, 4, "the bundle granted all four subjects");

  // Mathematics stacks on top of the month already owned; the others start now.
  const maths = new Date(bySubject.get("mathematics")!).getTime();
  const physics = new Date(bySubject.get("physics")!).getTime();
  assert.ok(maths > physics, "the owned subject keeps its remaining time and extends beyond the rest");
  assert.ok(
    maths >= new Date(soloExpiry).getTime(),
    "a bundle can only ever extend an existing term, never shorten it",
  );

  await rawPool().query(`UPDATE pricing.bundle_offers SET active = FALSE WHERE id = $1`, [bundleId]);
  await rawPool().query(`DELETE FROM pricing.bundle_offers WHERE id = $1`, [bundleId]);
  await invalidatePricingCache();
});

test("E19: a discount is clamped to the base, so the payable amount is never negative", opts, async () => {
  const base = 50_000;
  const hundredOff = `EDGE_PCT_${Date.now().toString(36).toUpperCase()}`;
  const overFlat = `EDGE_FLAT_${Date.now().toString(36).toUpperCase()}`;
  clampCoupons.push(hundredOff, overFlat);
  await rawPool().query(
    `INSERT INTO pricing.coupons (code, kind, value, applies_to, per_user_limit, active) VALUES
       ($1, 'percent', 100, 'any', 5, TRUE),
       ($2, 'flat', $3, 'any', 5, TRUE)`,
    [hundredOff, overFlat, base * 10],
  );
  const target = { kind: "subject" as const, subject: "physics", baseAmountMinor: base };

  const full = await validateCoupon({ code: hundredOff, userId: studentId, target });
  assert.equal(full.valid, true);
  assert.ok(full.valid && full.discountMinor === base);
  assert.ok(full.valid && full.finalMinor === 0, "100% off is free, never negative");

  const flat = await validateCoupon({ code: overFlat, userId: studentId, target });
  assert.ok(flat.valid && flat.discountMinor === base, "a flat coupon larger than the price clamps to it");
  assert.ok(flat.valid && flat.finalMinor === 0);
});

test("E16/E17: a coupon disabled after checkout still honours the payment already taken", opts, async () => {
  couponCode = `EDGE_${Date.now().toString(36).toUpperCase()}`;
  await rawPool().query(
    `INSERT INTO pricing.coupons (code, kind, value, applies_to, per_user_limit, active)
     VALUES ($1, 'percent', 10, 'any', 5, TRUE)`,
    [couponCode],
  );
  const opened = await checkout({ subject: "physics", couponCode });
  assert.equal(opened.amountMinor, 44_910, "10% off ₹499");

  // The admin pulls the coupon — and the student is already at the gateway.
  await rawPool().query(`UPDATE pricing.coupons SET active = FALSE WHERE code = $1`, [couponCode]);
  await rawPool().query(`UPDATE pricing.coupons SET valid_to = NOW() - INTERVAL '1 hour' WHERE code = $1`, [couponCode]);

  // Money has moved. Refusing the grant here would take the payment and give
  // nothing back, so the capture is honoured and the reservation committed.
  const applied = await capture(opened);
  assert.equal(applied.order.status, "paid");
  assert.equal(applied.grants.length, 1);
  const redemption = await rawPool().query(
    `SELECT state FROM pricing.coupon_redemptions WHERE code = $1 AND order_id = $2`,
    [couponCode, opened.orderId],
  );
  assert.equal(redemption.rows[0]?.state, "committed");
});

test("E25/E30: a capture that arrives before its order is retried by the drain, not dropped", opts, async () => {
  const razorpayOrderId = `order_edge_early_${Date.now().toString(36)}`;
  const paymentId = `pay_edge_early_${Date.now().toString(36)}`;
  paymentIds.push(paymentId);
  const eventId = `evt_edge_early_${Date.now().toString(36)}`;
  eventIds.push(eventId);
  const payload = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: { id: paymentId, order_id: razorpayOrderId, amount: 49_900, currency: "INR", method: "upi", status: "captured" },
      },
    },
  };

  // The webhook's durable write happens first and always succeeds …
  const recorded = await recordEvent({
    eventId,
    eventType: "payment.captured",
    entityId: paymentId,
    payload,
    livemode: false,
  });
  assert.equal(recorded.isNew, true);

  // … and inline application fails, because our order row does not exist yet.
  await assert.rejects(() => processPaymentEvent(payload), /unknown order/);
  await setEventStatus(eventId, "failed", { error: "Payment refers to an unknown order", retryInSeconds: 0 });

  // Nothing is lost: the raw payload is retained and still claimable.
  const stored = await getEvent(eventId);
  assert.equal(stored?.status, "failed");
  assert.deepEqual(stored?.payload, payload);

  // The checkout transaction now commits.
  const opened = await checkout({ subject: "physics" });
  await rawPool().query(`UPDATE payments.orders SET razorpay_order_id = $2 WHERE id = $1`, [
    opened.orderId,
    razorpayOrderId,
  ]);

  // The minute cron replays the stored event, and the student is unlocked.
  const drained = await drainPaymentEvents(50);
  assert.ok(drained.claimed >= 1);
  assert.ok(drained.processed >= 1, "the previously-failed event applied on retry");
  assert.equal((await getEvent(eventId))?.status, "processed");
  const order = await getOrderById(opened.orderId);
  assert.equal(order?.status, "paid");

  // Replaying it again is a no-op rather than a second grant.
  await setEventStatus(eventId, "pending", { retryInSeconds: 0 });
  const again = await drainPaymentEvents(50);
  assert.ok(again.processed + again.ignored >= 1);
  assert.equal((await getOrderById(opened.orderId))?.status, "paid");
  const grants = await rawPool().query(
    `SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE order_id = $1`,
    [opened.orderId],
  );
  assert.equal(grants.rows[0].n, 1, "the replay did not create a second grant");
});

test("E25: the drain never claims a subscription event and never parks early", opts, async () => {
  const subEventId = `evt_edge_sub_${Date.now().toString(36)}`;
  eventIds.push(subEventId);
  await recordEvent({
    eventId: subEventId,
    eventType: "subscription.charged",
    entityId: "sub_edge",
    payload: { event: "subscription.charged" },
    livemode: false,
  });
  const before = await getEvent(subEventId);
  await drainPaymentEvents(50);
  const after = await getEvent(subEventId);
  // Rail B owns its own retry (Razorpay redelivery). If this drain claimed it,
  // it would burn the attempts and destroy the record a human needs.
  assert.equal(after?.status, "pending");
  assert.equal(after?.attempts, before?.attempts);
});

test("teardown: remove the isolated edge-case fixtures", opts, async () => {
  const pool = rawPool();
  if (eventIds.length) {
    await pool.query(`DELETE FROM payments.events WHERE event_id = ANY($1)`, [eventIds]);
  }
  if (paymentIds.length) {
    await pool.query(`DELETE FROM payments.payments WHERE razorpay_payment_id = ANY($1)`, [paymentIds]);
  }
  if (orderIds.length) {
    await pool.query(`DELETE FROM entitlements.subject_grants WHERE order_id = ANY($1)`, [orderIds]);
    await pool.query(`DELETE FROM payments.orders WHERE id = ANY($1)`, [orderIds]);
  }
  const codes = [...clampCoupons, ...(couponCode ? [couponCode] : [])];
  if (codes.length) {
    await pool.query(`DELETE FROM pricing.coupon_redemptions WHERE code = ANY($1)`, [codes]);
    await pool.query(`DELETE FROM pricing.coupons WHERE code = ANY($1)`, [codes]);
  }
  await cleanup(fixtures);
  await closePool();
});
