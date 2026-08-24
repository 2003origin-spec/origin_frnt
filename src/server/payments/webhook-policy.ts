/** Pure parsing/age policy for the unified Rail-A webhook receiver. */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function eventDetails(body: Record<string, unknown>): {
  type: string | null;
  entityId: string | null;
} {
  const eventType = typeof body.event === "string" ? body.event : null;
  const payload = asRecord(body.payload);
  const payment = asRecord(payload.payment);
  const paymentEntity = asRecord(payment.entity);
  const refund = asRecord(payload.refund);
  const refundEntity = asRecord(refund.entity);
  const dispute = asRecord(payload.dispute);
  const disputeEntity = asRecord(dispute.entity);
  const order = asRecord(payload.order);
  const orderEntity = asRecord(order.entity);
  const primaryEntityId = eventType?.startsWith("refund.")
    ? refundEntity.id
    : eventType?.startsWith("payment.dispute.")
      ? disputeEntity.id
      : null;
  const entityId =
    (typeof primaryEntityId === "string" && primaryEntityId) ||
    (typeof paymentEntity.id === "string" && paymentEntity.id) ||
    (typeof refundEntity.id === "string" && refundEntity.id) ||
    (typeof disputeEntity.id === "string" && disputeEntity.id) ||
    (typeof orderEntity.id === "string" && orderEntity.id) ||
    (typeof payload.id === "string" && payload.id) ||
    null;
  return { type: eventType, entityId };
}

export function isStale(body: Record<string, unknown>, now = new Date()): boolean {
  const event = typeof body.event === "string" ? body.event : "";
  // Refunds and disputes are durable money/account events. They remain
  // actionable even if Razorpay redelivers them after the ordinary replay
  // horizon; dropping one would leave access or risk flags incorrect.
  if (event.startsWith("refund.") || event.startsWith("payment.dispute.")) return false;
  const created = body.created_at;
  if (typeof created !== "number" && typeof created !== "string") return false;
  const seconds = Number(created);
  if (!Number.isFinite(seconds)) return false;
  return now.getTime() - seconds * 1000 > 7 * 24 * 60 * 60 * 1000;
}
