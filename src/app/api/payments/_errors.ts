/**
 * Error → HTTP mapping for the student money routes.
 *
 * `handleTeacherError` maps any `Error` without a `status` to 400, which on a
 * money route tells the browser "your payment was rejected" for what is really
 * a pool timeout or a cold start. Here only typed errors keep their status;
 * everything else is a retryable 503.
 */

import { NextResponse } from "next/server";

import { FeatureDisabledError } from "@/lib/feature-flags";
import { metric } from "@/lib/metrics";
import { AuthzError } from "@/server/authz";
import { PaymentDomainError } from "@/server/payments/errors";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export const VERIFY_RETRY_AFTER_SECONDS = 5;
export const VERIFY_PENDING_DETAIL =
  "Payment received. We are activating your access — this can take a minute.";

function retryableResponse(detail: string, retryAfterSeconds: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { detail, ...extra },
    { status: 503, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Outer catch for payment routes: typed errors keep their status, the rest are 503. */
export function paymentsErrorResponse(error: unknown): NextResponse {
  if (error instanceof FeatureDisabledError || error instanceof AuthzError) {
    return handleTeacherError(error);
  }
  if (error instanceof PaymentDomainError) {
    return NextResponse.json({ detail: error.message }, { status: error.status });
  }
  const status = error instanceof Error ? (error as { status?: unknown }).status : undefined;
  if (typeof status === "number" && status >= 400 && status < 600 && status !== 503) {
    return NextResponse.json({ detail: (error as Error).message }, { status });
  }
  const retryAfter = error instanceof Error
    ? Number((error as { retryAfterSeconds?: unknown }).retryAfterSeconds) || 10
    : 10;
  console.error("[payments api] transient error", error);
  return retryableResponse("Payments are temporarily unavailable. Please retry shortly.", retryAfter);
}

/**
 * The verify fast-path ran AFTER Razorpay charged the student. A domain error
 * is a real rejection (4xx); anything else means "money landed, we could not
 * apply it right now" — 503 + `pending: true`, and the client polls the order.
 */
export function verifyApplyErrorResponse(error: unknown, orderId: string): NextResponse {
  if (error instanceof PaymentDomainError) {
    return NextResponse.json({ detail: error.message, orderId }, { status: error.status });
  }
  metric("origin.payments.verify.transient", {
    error: error instanceof Error ? error.name : "unknown",
  });
  console.error("[payments verify] transient apply failure", error);
  return retryableResponse(VERIFY_PENDING_DETAIL, VERIFY_RETRY_AFTER_SECONDS, { pending: true, orderId });
}
