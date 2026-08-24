import test from "node:test";
import assert from "node:assert/strict";

import { renderDunningEmail } from "@/server/payments/emails";
import { paidTermExpiry, rebasePaidGrantExpiries } from "@/server/payments/grants";
import {
  disputeInputFromEvent,
  refundInputFromEvent,
  validateRefundRequest,
  PaymentLifecycleError,
  REFUND_WINDOW_DAYS,
} from "@/server/payments/refunds-service";
import { eventDetails, isStale } from "@/server/payments/webhook-policy";
import {
  decideReconciliationAction,
  deterministicDunningOutboxId,
  expiryWarningDays,
  failedMandateDunningDays,
} from "@/server/payments/reconciliation-policy";

test("Phase 7 refund guard enforces capture, seven-day window, remainder, and positive amount", () => {
  const capturedAt = "2026-08-20T12:00:00.000Z";
  const now = new Date("2026-08-21T12:00:00.000Z");
  const full = validateRefundRequest({
    status: "captured",
    amountMinor: 49900,
    amountRefundedMinor: 0,
    capturedAt,
    now,
  });
  assert.equal(full.amountMinor, 49900);
  assert.equal(full.isFull, true);
  assert.equal(full.windowEndsAt, "2026-08-27T12:00:00.000Z");

  const partial = validateRefundRequest({
    status: "captured",
    amountMinor: 49900,
    amountRefundedMinor: 10000,
    requestedAmountMinor: 20000,
    capturedAt,
    now,
  });
  assert.equal(partial.amountMinor, 20000);
  assert.equal(partial.isFull, false);

  assert.throws(
    () => validateRefundRequest({ status: "authorized", amountMinor: 100, amountRefundedMinor: 0, capturedAt, now }),
    (error: unknown) => error instanceof PaymentLifecycleError && error.status === 409,
  );
  assert.throws(
    () => validateRefundRequest({ status: "captured", amountMinor: 100, amountRefundedMinor: 0, requestedAmountMinor: 101, capturedAt, now }),
    /exceeds the remaining/,
  );
  assert.throws(
    () => validateRefundRequest({ status: "captured", amountMinor: 100, amountRefundedMinor: 0, requestedAmountMinor: 10.5, capturedAt, now }),
    (error: unknown) => error instanceof PaymentLifecycleError && error.status === 400,
  );
  assert.throws(
    () => validateRefundRequest({ status: "captured", amountMinor: 100, amountRefundedMinor: 0, capturedAt, now: new Date("2026-08-28T00:00:00.000Z") }),
    new RegExp(`${REFUND_WINDOW_DAYS}-day refund window`),
  );
});

test("full cumulative refund rebasing arithmetic isolates orders", () => {
  const first = new Date("2026-01-01T00:00:00.000Z");
  const rebased = rebasePaidGrantExpiries([
    { id: "order-a", paidAt: first, termMonths: 3 },
    { id: "order-b", paidAt: new Date("2026-02-01T00:00:00.000Z"), termMonths: 3 },
  ]);
  assert.equal(rebased.find((row) => row.id === "order-a")?.expiresAt.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(rebased.find((row) => row.id === "order-b")?.expiresAt.toISOString(), "2026-07-01T00:00:00.000Z");

  const afterRefund = rebasePaidGrantExpiries([
    { id: "order-b", paidAt: new Date("2026-02-01T00:00:00.000Z"), termMonths: 3 },
  ]);
  assert.equal(afterRefund[0].expiresAt.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(paidTermExpiry(null, 1, new Date("2026-01-31T00:00:00.000Z")).toISOString(), "2026-02-28T00:00:00.000Z");
});

test("refund and dispute webhook payloads map to the shared lifecycle inputs", () => {
  const refund = refundInputFromEvent({
    payload: {
      refund: {
        entity: {
          id: "rfnd_phase7",
          payment_id: "pay_phase7",
          amount: 12500,
          status: "processed",
          created_at: 1_777_000_000,
          notes: { origin_reason: "requested by support" },
        },
      },
    },
  });
  assert.equal(refund.razorpayRefundId, "rfnd_phase7");
  assert.equal(refund.razorpayPaymentId, "pay_phase7");
  assert.equal(refund.amountMinor, 12500);
  assert.equal(refund.reason, "requested by support");

  const dispute = disputeInputFromEvent({
    payload: {
      dispute: { entity: { id: "dsp_phase7", payment_id: "pay_phase7", status: "open" } },
    },
  });
  assert.deepEqual(
    { disputeId: dispute.disputeId, paymentId: dispute.razorpayPaymentId, status: dispute.status },
    { disputeId: "dsp_phase7", paymentId: "pay_phase7", status: "open" },
  );
});

test("webhook intake identifies refund/dispute entities and never age-drops them", () => {
  const oldCreatedAt = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
  const refund = {
    event: "refund.processed",
    created_at: oldCreatedAt,
    payload: {
      payment: { entity: { id: "pay_old" } },
      refund: { entity: { id: "rfnd_old" } },
    },
  };
  assert.deepEqual(eventDetails(refund), { type: "refund.processed", entityId: "rfnd_old" });
  assert.equal(isStale(refund), false);

  const dispute = {
    event: "payment.dispute.created",
    created_at: oldCreatedAt,
    payload: {
      payment: { entity: { id: "pay_old" } },
      dispute: { entity: { id: "dsp_old" } },
    },
  };
  assert.deepEqual(eventDetails(dispute), { type: "payment.dispute.created", entityId: "dsp_old" });
  assert.equal(isStale(dispute), false);
  assert.equal(isStale({ event: "payment.captured", created_at: oldCreatedAt }), true);
});

test("reconciliation policy captures, expires only at the local horizon, and otherwise waits", () => {
  const now = new Date("2026-08-23T00:00:00.000Z");
  assert.equal(decideReconciliationAction({ capturedPayment: { status: "captured" }, expiresAt: new Date("2026-08-01"), now }), "captured");
  assert.equal(decideReconciliationAction({ capturedPayment: null, expiresAt: new Date("2026-08-22"), now }), "expire");
  assert.equal(decideReconciliationAction({ externalStatus: "paid", capturedPayment: null, expiresAt: new Date("2026-08-22"), now }), "wait");
  assert.equal(decideReconciliationAction({ capturedPayment: null, expiresAt: null, createdAt: new Date("2026-08-22T23:00:00.000Z"), now }), "expire");
  assert.equal(decideReconciliationAction({ externalStatus: "attempted", capturedPayment: null, expiresAt: new Date("2026-08-24"), now }), "wait");
});

test("dunning milestones and ids are deterministic", () => {
  const now = new Date("2026-08-23T00:00:00.000Z");
  assert.equal(expiryWarningDays(new Date("2026-08-30T00:00:00.000Z"), now), 7);
  assert.equal(expiryWarningDays(new Date("2026-08-24T00:00:00.000Z"), now), 1);
  assert.equal(failedMandateDunningDays(new Date("2026-08-23T00:00:00.000Z"), now), 0);
  assert.equal(failedMandateDunningDays(new Date("2026-08-20T00:00:00.000Z"), now), 3);
  assert.equal(
    deterministicDunningOutboxId({ kind: "expiry_warning", sourceId: "grant_1", milestone: 7 }),
    "payment_dunning_expiry_warning_grant_1_7",
  );

  const mandate = renderDunningEmail({
    to: "student@example.test",
    subject: "physics",
    dunningKind: "mandate_failed",
    retryHref: "/premium",
  });
  assert.match(mandate.text, /could not collect the latest payment/i);
  assert.doesNotMatch(mandate.text, /scheduled to end in 0 days/i);
});
