/**
 * Phase 6 — pure parsing/serialisation contract for the Rail B ledger bridge.
 *
 * These run without a database: they pin the shape assumptions this phase makes
 * about Razorpay's subscription webhook bodies, which are what decide whether a
 * charge is ledgered and whether the E27 ordering fence has a timestamp to use.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  deserializeCharge,
  epochSecondsToDate,
  parseSubscriptionEvent,
  serializeCharge,
} from "@/server/payments/subscription-ledger";

const CHARGED_BODY = {
  event: "subscription.charged",
  created_at: 1_755_000_000,
  payload: {
    subscription: {
      entity: { id: "sub_ABC", status: "active", current_end: 1_757_600_000 },
    },
    payment: {
      entity: {
        id: "pay_XYZ",
        amount: 49900,
        currency: "inr",
        method: "upi",
        status: "captured",
        invoice_id: "inv_123",
        fee: 1180,
        tax: 180,
        created_at: 1_755_000_010,
      },
    },
  },
};

test("parseSubscriptionEvent reads the subscription, the event time and the charge", () => {
  const parsed = parseSubscriptionEvent(CHARGED_BODY);
  assert.equal(parsed.eventType, "subscription.charged");
  assert.equal(parsed.razorpaySubscriptionId, "sub_ABC");
  assert.equal(parsed.eventAt?.getTime(), 1_755_000_000_000);
  assert.equal(parsed.currentPeriodEnd?.getTime(), 1_757_600_000_000);
  assert.ok(parsed.charge);
  assert.equal(parsed.charge?.razorpayPaymentId, "pay_XYZ");
  assert.equal(parsed.charge?.amountMinor, 49900);
  // Razorpay sends lowercase currency codes; the ledger stores INR.
  assert.equal(parsed.charge?.currency, "INR");
  assert.equal(parsed.charge?.method, "upi");
  assert.equal(parsed.charge?.razorpayInvoiceId, "inv_123");
  assert.equal(parsed.charge?.feeMinor, 1180);
  assert.equal(parsed.charge?.taxMinor, 180);
  assert.equal(parsed.charge?.capturedAt?.getTime(), 1_755_000_010_000);
});

test("a lifecycle event without a payment entity yields no charge", () => {
  const parsed = parseSubscriptionEvent({
    event: "subscription.halted",
    created_at: 1_755_000_500,
    payload: { subscription: { entity: { id: "sub_ABC" } } },
  });
  assert.equal(parsed.charge, null);
  assert.equal(parsed.razorpaySubscriptionId, "sub_ABC");
  assert.equal(parsed.currentPeriodEnd, null);
  assert.equal(parsed.eventAt?.getTime(), 1_755_000_500_000);
});

test("a body with no created_at leaves the ordering fence unset rather than guessing", () => {
  // Null means "apply unconditionally" — the pre-Phase-6 behaviour. Substituting
  // NOW() here would let an old redelivery outrank a newer stored event.
  const parsed = parseSubscriptionEvent({
    event: "subscription.activated",
    payload: { subscription: { entity: { id: "sub_NOTS" } } },
  });
  assert.equal(parsed.eventAt, null);
});

test("a malformed body degrades to nulls instead of throwing", () => {
  for (const body of [null, undefined, 42, "nope", {}, { payload: "x" }]) {
    const parsed = parseSubscriptionEvent(body);
    assert.equal(parsed.razorpaySubscriptionId, null);
    assert.equal(parsed.charge, null);
  }
});

test("epochSecondsToDate rejects non-positive and non-finite input", () => {
  assert.equal(epochSecondsToDate(0), null);
  assert.equal(epochSecondsToDate(-5), null);
  assert.equal(epochSecondsToDate("abc"), null);
  assert.equal(epochSecondsToDate(null), null);
  assert.equal(epochSecondsToDate(1_755_000_000)?.getTime(), 1_755_000_000_000);
});

test("a charge survives the JSONB round-trip the connect job queue puts it through", () => {
  const parsed = parseSubscriptionEvent(CHARGED_BODY);
  assert.ok(parsed.charge);
  const wire = JSON.parse(JSON.stringify(serializeCharge(parsed.charge!)));
  assert.deepEqual(deserializeCharge(wire), parsed.charge);
});

test("deserializeCharge refuses a payload with no payment id or amount", () => {
  assert.equal(deserializeCharge({ amountMinor: 100 }), null);
  assert.equal(deserializeCharge({ razorpayPaymentId: "pay_1" }), null);
  assert.equal(deserializeCharge(null), null);
});
