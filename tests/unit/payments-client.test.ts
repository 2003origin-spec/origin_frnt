/** Phase 3 browser-client contract tests. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createCheckoutOrder,
  listPaymentOrders,
  verifyPayment,
} from "../../src/features/payments/client";

type Captured = { url: string; init?: RequestInit };

async function withBrowserStubs<T>(
  responder: (request: Captured) => Response,
  run: (captured: Captured[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const captured: Captured[] = [];
  (globalThis as { document?: unknown }).document = { cookie: "origin_csrf=test-csrf" };
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const request = { url: typeof input === "string" ? input : String(input), init };
    captured.push(request);
    return responder(request);
  }) as typeof fetch;

  try {
    return await run(captured);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = originalDocument;
  }
}

test("checkout client sends only the product intent and an idempotency key", async () => {
  await withBrowserStubs(
    () => new Response(JSON.stringify({
      orderId: "ord_1",
      razorpayOrderId: "order_rzp_1",
      amountMinor: 49900,
      currency: "INR",
      keyId: "rzp_test_abc",
    }), { status: 201 }),
    async (captured) => {
      const result = await createCheckoutOrder(
        { kind: "subject_term", subject: "physics", termMonths: 1 },
        { idempotencyKey: "checkout-key-1" },
      );

      assert.equal(result.amountMinor, 49900);
      assert.equal(captured.length, 1);
      const request = captured[0];
      assert.equal(request.url, "/api/payments/checkout");
      const headers = new Headers(request.init?.headers);
      assert.equal(headers.get("idempotency-key"), "checkout-key-1");
      assert.equal(headers.get("x-csrf-token"), "test-csrf");
      const body = JSON.parse(String(request.init?.body)) as Record<string, unknown>;
      assert.deepEqual(body, { kind: "subject_term", subject: "physics", termMonths: 1 });
      assert.equal("amountMinor" in body, false, "the browser must never choose the amount");
    },
  );
});

test("verify client posts Razorpay's signed response and returns the apply result", async () => {
  await withBrowserStubs(
    (request) => {
      assert.equal(request.url, "/api/payments/verify");
      return new Response(JSON.stringify({ ok: true, alreadyApplied: false }), { status: 200 });
    },
    async (captured) => {
      const result = await verifyPayment({
        razorpayOrderId: "order_rzp_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "signature",
      });
      assert.equal(result.ok, true);
      const body = JSON.parse(String(captured[0].init?.body));
      assert.deepEqual(body, {
        razorpayOrderId: "order_rzp_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "signature",
      });
    },
  );
});

test("order history client normalizes the route's { orders } envelope", async () => {
  await withBrowserStubs(
    () => new Response(JSON.stringify({ orders: [{ id: "ord_1", status: "paid", amountMinor: 49900 }] }), { status: 200 }),
    async () => {
      const orders = await listPaymentOrders();
      assert.equal(orders.length, 1);
      assert.equal(orders[0].id, "ord_1");
      assert.equal(orders[0].status, "paid");
    },
  );
});

