/** Pure Phase 7 reconciliation/dunning policy. No database or SDK imports. */

const DAY_MS = 24 * 60 * 60 * 1000;
const LEGACY_ORDER_EXPIRY_MS = 30 * 60 * 1000;

export type ReconciliationPaymentSnapshot = { status?: string };
export type ReconciliationDecision = "captured" | "expire" | "wait";

export function decideReconciliationAction(input: {
  externalStatus?: string | null;
  capturedPayment?: ReconciliationPaymentSnapshot | null;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  now?: Date;
}): ReconciliationDecision {
  if (input.capturedPayment?.status === "captured") return "captured";
  // Razorpay can expose the terminal order state before fetchPayments reflects
  // the captured row. Never expire money that the gateway already calls paid;
  // a later reconciliation pass will apply the eventual payment snapshot.
  if (input.externalStatus?.toLowerCase() === "paid") return "wait";

  const explicitExpiry = input.expiresAt ? new Date(input.expiresAt) : null;
  const createdAt = input.createdAt ? new Date(input.createdAt) : null;
  const expiresAt = explicitExpiry && Number.isFinite(explicitExpiry.getTime())
    ? explicitExpiry
    : createdAt && Number.isFinite(createdAt.getTime())
      ? new Date(createdAt.getTime() + LEGACY_ORDER_EXPIRY_MS)
      : null;
  if (expiresAt && Number.isFinite(expiresAt.getTime()) && (input.now ?? new Date()).getTime() >= expiresAt.getTime()) {
    return "expire";
  }
  return "wait";
}

export const reconciliationDecision = decideReconciliationAction;

export function expiryWarningDays(expiry: Date | string, now = new Date()): 7 | 1 | null {
  const date = new Date(expiry);
  if (!Number.isFinite(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
  return days === 7 || days === 1 ? days : null;
}

export function failedMandateDunningDays(updatedAt: Date | string, now = new Date()): 0 | 3 | null {
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  return days === 0 || days === 3 ? days as 0 | 3 : null;
}

/**
 * WHERE-clause for the stale coupon-hold sweep (bug-fix P2). `$1` is `now`.
 *
 * An order-backed hold lives exactly as long as its order: it is released only
 * once the order is terminal (`failed`/`expired`), never on the hold's own
 * `expires_at`, because a Razorpay order stays payable after our 30-minute
 * TTL and a late capture must still find its hold. The reconcile `expire`
 * action is therefore the single TTL for order holds. Subscription/legacy
 * holds (no order) keep the `expires_at` sweep; a hold whose order row has
 * vanished is released 30 minutes after it was taken.
 */
export const STALE_COUPON_HOLD_WHERE_SQL = `r.state = 'reserved'
        AND (
          (r.order_id IS NULL AND r.expires_at <= $1)
          OR o.status IN ('failed', 'expired')
          OR (o.id IS NULL AND r.order_id IS NOT NULL AND r.redeemed_at <= $1 - INTERVAL '30 minutes')
        )`;

export function deterministicDunningOutboxId(input: {
  kind: "expiry_warning" | "mandate_failed";
  sourceId: string;
  milestone: number;
}): string {
  return `payment_dunning_${input.kind}_${input.sourceId}_${input.milestone}`;
}
