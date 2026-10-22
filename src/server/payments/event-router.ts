/**
 * Routes one stored Rail-A webhook event to its handler.
 *
 * Split out of `orders-service` so the routing decisions (which handler an
 * event reaches, and which events are deliberately ignored) are testable with
 * stub handlers — `orders-service` itself pulls in the `server-only` pricing
 * graph and cannot be loaded by the unit runner.
 */

import {
  disputeInputFromEvent,
  refundInputFromEvent,
  type RefundLifecycleInput,
} from "./refunds-service";

export type PaymentEventInput = {
  event?: string | null;
  payload?: Record<string, unknown>;
  livemode?: boolean;
};

export type PaymentEventHandlers<TRefund, TDispute, TFailed, TCaptured> = {
  applyRefundLifecycle(input: RefundLifecycleInput): Promise<TRefund>;
  applyDisputeCreated(input: ReturnType<typeof disputeInputFromEvent>): Promise<TDispute>;
  /** A failed ATTEMPT: keeps the order open and its coupon hold reserved (P2). */
  markPaymentAttemptFailed(input: {
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    reason: string;
    payment: Record<string, unknown>;
  }): Promise<TFailed | null>;
  applyPaymentSuccess(input: {
    razorpayOrderId: string | null;
    razorpayPaymentId: string;
    amountMinor: number | null;
    currency: string | null;
    method: string | null;
    feeMinor: number | null;
    taxMinor: number | null;
    raw: Record<string, unknown>;
  }): Promise<TCaptured>;
};

export const REFUND_EVENTS = new Set(["refund.created", "refund.processed", "refund.failed"]);

function asMinor(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

/** Applies the supported Rail A webhook event shapes. Returns null for "no work". */
export async function routePaymentEvent<TRefund, TDispute, TFailed, TCaptured>(
  input: PaymentEventInput | Record<string, unknown>,
  handlers: PaymentEventHandlers<TRefund, TDispute, TFailed, TCaptured>,
): Promise<TRefund | TDispute | TFailed | TCaptured | null> {
  const body = (input.payload ?? input) as Record<string, unknown>;
  const event = String(input.event ?? body.event ?? "");
  const payload = (body.payload as Record<string, unknown> | undefined) ?? body;
  const payment = (payload.payment as Record<string, unknown> | undefined) ?? {};
  const paymentEntity = (payment.entity as Record<string, unknown> | undefined) ?? payment;
  const order = (payload.order as Record<string, unknown> | undefined) ?? {};
  const orderEntity = (order.entity as Record<string, unknown> | undefined) ?? order;
  const rzpOrderId = String(
    paymentEntity.order_id ?? orderEntity.id ?? payload.order_id ?? "",
  ) || null;
  const paymentId = String(paymentEntity.id ?? payload.payment_id ?? "") || null;

  // Refunds route BEFORE the generic `.failed` branch: `refund.failed` used to
  // fall into markOrderFailed, which is a no-op on a paid order, so a failed
  // refund was silently discarded.
  if (REFUND_EVENTS.has(event)) {
    return handlers.applyRefundLifecycle(refundInputFromEvent(body, event));
  }
  if (event === "payment.dispute.created") {
    return handlers.applyDisputeCreated(disputeInputFromEvent(body));
  }

  // A subscription invoice charge belongs to the recurring rails. It only lands
  // here when the dashboard subscribes this URL to payment events it should not
  // (P7 item 3c); applying it would throw "unknown order" ten times and park.
  if (
    (event.startsWith("payment.") || event.startsWith("order.")) &&
    text(paymentEntity.invoice_id)
  ) {
    return null;
  }

  if (event === "payment.failed" || event.endsWith(".failed")) {
    // A failed attempt keeps the order open and the coupon hold reserved (P2):
    // the Razorpay order is still payable and the student usually retries.
    const failed = await handlers.markPaymentAttemptFailed({
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: paymentId,
      reason: String(paymentEntity.error_description ?? paymentEntity.error_reason ?? "payment_failed"),
      payment: paymentEntity,
    });
    // A failure can arrive before the local checkout transaction commits. Keep
    // the durable event retryable rather than incorrectly marking it ignored.
    if (!failed) throw new Error("Payment failure refers to an unknown order");
    return failed;
  }
  if (event === "order.paid" || event === "payment.captured" || event.endsWith(".captured")) {
    if (!paymentId) throw new Error("Captured payment event has no payment id");
    return handlers.applyPaymentSuccess({
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: paymentId,
      amountMinor: asMinor(paymentEntity.amount),
      currency: paymentEntity.currency == null ? null : String(paymentEntity.currency),
      method: paymentEntity.method == null ? null : String(paymentEntity.method),
      feeMinor: asMinor(paymentEntity.fee),
      taxMinor: asMinor(paymentEntity.tax),
      raw: body,
    });
  }
  return null;
}
