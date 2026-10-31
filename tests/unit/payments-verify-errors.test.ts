/**
 * P6 — the verify fast-path must never tell a charged student "rejected" for a
 * transient failure. Domain errors keep their 4xx; everything else is a 503
 * with Retry-After and `pending: true`, which the checkout turns into a poll.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { paymentsErrorResponse, verifyApplyErrorResponse } from "@/app/api/payments/_errors";
import { AuthzError } from "@/server/authz";
import { PaymentDomainError } from "@/server/payments/errors";

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

test("a domain rejection keeps its 4xx status and the order id", async () => {
  for (const status of [404, 409, 422] as const) {
    const response = verifyApplyErrorResponse(new PaymentDomainError(status, "Captured amount does not match the order amount"), "ord_1");
    assert.equal(response.status, status);
    const data = await body(response);
    assert.equal(data.orderId, "ord_1");
    assert.equal(data.pending, undefined);
    assert.match(String(data.detail), /does not match/);
    assert.equal(response.headers.get("retry-after"), null);
  }
});

test("a pg / transient error is a 503 with Retry-After and pending:true — not a 400", async () => {
  const pgError = Object.assign(new Error("Connection terminated unexpectedly"), { code: "57P01" });
  for (const error of [pgError, new Error("ECONNRESET"), new Error("Payment refers to an unknown order lock timeout"), "boom"]) {
    const response = verifyApplyErrorResponse(error, "ord_2");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "5");
    const data = await body(response);
    assert.equal(data.pending, true);
    assert.equal(data.orderId, "ord_2");
    assert.match(String(data.detail), /activating your access/);
  }
});

test("an Error that merely carries a status-less message never becomes a 400 on money routes", async () => {
  const response = paymentsErrorResponse(new Error("Invalid date"));
  assert.equal(response.status, 503);
  assert.ok(response.headers.get("retry-after"));
});

test("typed errors on the outer catch keep their meaning", async () => {
  assert.equal(paymentsErrorResponse(new PaymentDomainError(404, "Payment refers to an unknown order")).status, 404);
  assert.equal(paymentsErrorResponse(new AuthzError(401, "Sign in required.")).status, 401);
  assert.equal(paymentsErrorResponse(new AuthzError(403, "Student role required.")).status, 403);
  // PaymentGatewayError shape: status 503 + retryAfterSeconds.
  const gateway = Object.assign(new Error("Razorpay unavailable"), { status: 503, retryAfterSeconds: 10 });
  const gatewayResponse = paymentsErrorResponse(gateway);
  assert.equal(gatewayResponse.status, 503);
  assert.equal(gatewayResponse.headers.get("retry-after"), "10");
  // A typed non-503 status (e.g. PaymentLifecycleError 409) is preserved.
  assert.equal(paymentsErrorResponse(Object.assign(new Error("Refund window expired"), { status: 409 })).status, 409);
});
