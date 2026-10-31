/**
 * The webhook event retry loop, exercised through injected store primitives so
 * the batch semantics can be asserted without a database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  drainPaymentEvents,
  eventRetryDelaySeconds,
} from "@/server/payments/events-drain";
import { routePaymentEvent, type PaymentEventInput } from "@/server/payments/event-router";
import { MAX_EVENT_ATTEMPTS, type PaymentEvent } from "@/server/payments/payments-store";

function event(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    eventId: "evt_1",
    eventType: "payment.captured",
    entityId: "pay_1",
    payload: { event: "payment.captured" },
    status: "pending",
    attempts: 1,
    error: null,
    livemode: false,
    receivedAt: "2026-08-23T00:00:00.000Z",
    processedAt: null,
    nextAttemptAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

type Marked = { id: string; status: string; error?: string | null; retryInSeconds?: number };

function recorder() {
  const marks: Marked[] = [];
  const mark = (async (id: string, status: string, opts?: { error?: string | null; retryInSeconds?: number }) => {
    marks.push({ id, status, error: opts?.error ?? null, retryInSeconds: opts?.retryInSeconds });
  }) as never;
  return { marks, mark };
}

test("backoff climbs 1m→30m and then stops climbing", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 20].map(eventRetryDelaySeconds),
    [60, 120, 240, 480, 960, 1800, 1800, 1800],
  );
  // A zero or negative attempt count must never produce a sub-minute retry.
  assert.equal(eventRetryDelaySeconds(0), 60);
  assert.equal(eventRetryDelaySeconds(-5), 60);
});

test("a successful apply marks the event processed", async () => {
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [event()]) as never,
    process: (async () => ({ ok: true })) as never,
    mark,
  });
  assert.deepEqual(result, { claimed: 1, processed: 1, ignored: 0, retrying: 0, parked: 0 });
  assert.deepEqual(marks, [{ id: "evt_1", status: "processed", error: null, retryInSeconds: undefined }]);
});

test("an apply that returns nothing is `ignored`, not a failure", async () => {
  // processPaymentEvent returns null for an event type Rail A has no work for.
  // Treating that as a failure would burn attempts and park a healthy event.
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [event({ eventType: "payment.authorized" })]) as never,
    process: (async () => null) as never,
    mark,
  });
  assert.equal(result.ignored, 1);
  assert.equal(result.retrying, 0);
  assert.equal(marks[0].status, "ignored");
});

test("a failing apply is rescheduled with backoff and keeps its error", async () => {
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [event({ attempts: 3 })]) as never,
    process: (async () => {
      throw new Error("Payment refers to an unknown order");
    }) as never,
    mark,
  });
  assert.deepEqual(result, { claimed: 1, processed: 0, ignored: 0, retrying: 1, parked: 0 });
  assert.equal(marks[0].status, "failed");
  assert.match(String(marks[0].error), /unknown order/);
  assert.equal(marks[0].retryInSeconds, eventRetryDelaySeconds(3));
});

test("an event at the attempt cap is reported parked, and not retried soon", async () => {
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [event({ attempts: MAX_EVENT_ATTEMPTS })]) as never,
    process: (async () => {
      throw new Error("poison");
    }) as never,
    mark,
  });
  assert.equal(result.parked, 1);
  assert.equal(result.retrying, 0);
  // A long delay, not zero: raising the cap after an incident must not stampede
  // every parked event into the next tick.
  assert.equal(marks[0].retryInSeconds, 30 * 60);
});

test("one poisoned event never aborts the rest of the batch", async () => {
  const { marks, mark } = recorder();
  const events = [
    event({ eventId: "evt_ok_1" }),
    event({ eventId: "evt_bad" }),
    event({ eventId: "evt_ok_2" }),
  ];
  const result = await drainPaymentEvents(10, {
    claim: (async () => events) as never,
    process: (async (input: { payload: unknown }) => {
      const id = (input as { event?: string }).event;
      if (id === undefined) throw new Error("unreachable");
      return { ok: true };
    }) as never,
    mark,
  });
  assert.equal(result.claimed, 3);
  assert.equal(result.processed, 3);
  assert.deepEqual(marks.map((m) => m.id), ["evt_ok_1", "evt_bad", "evt_ok_2"]);

  const { marks: marks2, mark: mark2 } = recorder();
  let call = 0;
  const mixed = await drainPaymentEvents(10, {
    claim: (async () => events) as never,
    process: (async () => {
      call += 1;
      if (call === 2) throw new Error("poison");
      return { ok: true };
    }) as never,
    mark: mark2,
  });
  assert.deepEqual(mixed, { claimed: 3, processed: 2, ignored: 0, retrying: 1, parked: 0 });
  assert.deepEqual(marks2.map((m) => m.status), ["processed", "failed", "processed"]);
});

test("an empty claim is a clean no-op — the cron runs every minute", async () => {
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(25, {
    claim: (async () => []) as never,
    process: (async () => {
      throw new Error("must not run");
    }) as never,
    mark,
  });
  assert.deepEqual(result, { claimed: 0, processed: 0, ignored: 0, retrying: 0, parked: 0 });
  assert.deepEqual(marks, []);
});

test("the batch size is clamped so a cron tick cannot run unbounded", async () => {
  const seen: number[] = [];
  const claim = (async (limit: number) => {
    seen.push(limit);
    return [];
  }) as never;
  for (const limit of [-10, 0, 1, 25, 1000]) {
    await drainPaymentEvents(limit, { claim, process: (async () => null) as never, mark: (async () => {}) as never });
  }
  assert.deepEqual(seen, [1, 1, 1, 25, 100]);
});

// ─── routing through the real event router (P4 / P7) ──────────────────────────
// `processPaymentEvent` is `routePaymentEvent` bound to the real handlers; here
// the handlers are stubs that record which one each stored event reached.

function routedProcess() {
  const calls: string[] = [];
  const seen: Record<string, unknown>[] = [];
  const handlers = {
    applyRefundLifecycle: async (input: Record<string, unknown>) => {
      calls.push("refund");
      seen.push(input);
      return { refund: true };
    },
    applyDisputeCreated: async () => {
      calls.push("dispute");
      return { dispute: true };
    },
    markPaymentAttemptFailed: async () => {
      calls.push("failed");
      return { failed: true };
    },
    applyPaymentSuccess: async () => {
      calls.push("captured");
      return { captured: true };
    },
  };
  const process = ((input: PaymentEventInput) => routePaymentEvent(input, handlers as never)) as never;
  return { calls, seen, process };
}

const refundPayload = (event: string, status?: string) => ({
  event,
  payload: {
    refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 49900, ...(status ? { status } : {}) } },
  },
});

test("refund.failed reaches the refund lifecycle as `failed`, never markOrderFailed", async () => {
  const { calls, seen, process } = routedProcess();
  const { marks, mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [
      event({ eventId: "evt_rf", eventType: "refund.failed", payload: refundPayload("refund.failed", "failed") }),
    ]) as never,
    process,
    mark,
  });
  assert.deepEqual(calls, ["refund"]);
  assert.equal(seen[0].status, "failed");
  assert.equal(result.processed, 1);
  assert.equal(marks[0].status, "processed");
});

test("refund.created is applied as pending and refund.processed as processed", async () => {
  const { calls, seen, process } = routedProcess();
  const { mark } = recorder();
  await drainPaymentEvents(10, {
    claim: (async () => [
      // The stored body may lack `event`; the drain passes the type separately.
      event({ eventId: "evt_c", eventType: "refund.created", payload: { payload: refundPayload("x").payload } }),
      event({ eventId: "evt_p", eventType: "refund.processed", payload: refundPayload("refund.processed", "processed") }),
    ]) as never,
    process,
    mark,
  });
  assert.deepEqual(calls, ["refund", "refund"]);
  assert.deepEqual(seen.map((input) => input.status), ["pending", "processed"]);
});

test("a subscription-invoice capture on the payments URL is ignored, not retried", async () => {
  const { calls, process } = routedProcess();
  const { marks, mark } = recorder();
  const invoiceCapture = (type: string) => event({
    eventId: `evt_${type}`,
    eventType: type,
    payload: {
      event: type,
      payload: {
        payment: { entity: { id: "pay_sub", order_id: "order_sub", amount: 49900, invoice_id: "inv_1", status: "captured" } },
      },
    },
  });
  const result = await drainPaymentEvents(10, {
    claim: (async () => [invoiceCapture("payment.captured"), invoiceCapture("order.paid"), invoiceCapture("payment.failed")]) as never,
    process,
    mark,
  });
  assert.deepEqual(calls, [], "no Rail-A handler is invoked for a subscription charge");
  assert.equal(result.ignored, 3);
  assert.equal(result.retrying, 0);
  assert.deepEqual(marks.map((m) => m.status), ["ignored", "ignored", "ignored"]);
});

test("a Rail-A capture without an invoice id still reaches applyPaymentSuccess", async () => {
  const { calls, process } = routedProcess();
  const { mark } = recorder();
  const result = await drainPaymentEvents(10, {
    claim: (async () => [event({
      payload: { event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 49900 } } } },
    })]) as never,
    process,
    mark,
  });
  assert.deepEqual(calls, ["captured"]);
  assert.equal(result.processed, 1);
});
