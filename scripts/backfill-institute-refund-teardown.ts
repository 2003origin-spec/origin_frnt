/**
 * One-off backfill for P3 (docs/bug-fixes/05-payments-entitlements.md): institute
 * offerings that were FULLY refunded before refunds tore down enrolments.
 *
 * Before the fix a processed full refund of an `institute_offering` order
 * flipped `payments.orders` to `refunded` and stopped there: the commerce order
 * stayed `paid`, the student stayed enrolled and in the target batch, and a
 * re-purchase 409'd "already purchased" forever. This finds those orders and
 * enqueues the same `institute_enrollment_revoke` outbox row the live refund
 * path now enqueues. The outbox drain (every minute) then runs
 * `applyEnrollmentOrderRefundBySystem`, which only tears down a `paid_app`
 * enrolment with no other live paid source.
 *
 * Safety:
 *   - dry run by default; `--apply` only INSERTs outbox rows (ON CONFLICT DO
 *     NOTHING, same deterministic id as the live path) — no money is touched;
 *   - only orders whose PROCESSED refunds cover the whole payment qualify; a
 *     refund still `pending` is listed and skipped (settle it first);
 *   - only commerce orders still `paid` are enqueued (already-refunded ones are
 *     reported and skipped).
 * Tell the institute admins before running `--apply`: their students lose access.
 *
 * Usage
 *   cd new-frontend
 *   npx tsx --env-file=.env.local scripts/backfill-institute-refund-teardown.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/backfill-institute-refund-teardown.ts --apply  # enqueue
 */

import { enqueueOutbox } from "@/server/payments/payments-store";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

const apply = process.argv.includes("--apply");

type Candidate = {
  orderId: string;
  userId: string;
  workspaceId: string | null;
  enrollmentOrderId: string | null;
  razorpayPaymentId: string | null;
  paymentAmountMinor: number;
  processedRefundMinor: number;
  pendingRefundMinor: number;
  lastProcessedRefundId: string | null;
  commerceStatus: string | null;
};

async function main() {
  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL is not set — load the env file before running.");
    process.exit(1);
  }
  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");

  const result = await pool.query(
    `SELECT o.id AS order_id, o.user_id, o.workspace_id,
            o.notes->>'enrollment_order_id' AS enrollment_order_id,
            p.razorpay_payment_id, p.amount_minor AS payment_amount_minor,
            COALESCE((SELECT SUM(r.amount_minor) FROM payments.refunds r
                       WHERE r.razorpay_payment_id = p.razorpay_payment_id AND r.status = 'processed'), 0)::bigint
              AS processed_refund_minor,
            COALESCE((SELECT SUM(r.amount_minor) FROM payments.refunds r
                       WHERE r.razorpay_payment_id = p.razorpay_payment_id AND r.status = 'pending'), 0)::bigint
              AS pending_refund_minor,
            (SELECT r.razorpay_refund_id FROM payments.refunds r
              WHERE r.razorpay_payment_id = p.razorpay_payment_id AND r.status = 'processed'
              ORDER BY r.created_at DESC LIMIT 1) AS last_processed_refund_id,
            e.status::text AS commerce_status
       FROM payments.orders o
       LEFT JOIN payments.payments p ON p.order_id = o.id
       LEFT JOIN commerce.enrollment_orders e
              ON e.id = o.notes->>'enrollment_order_id' AND e.workspace_id = o.workspace_id
      WHERE o.kind = 'institute_offering' AND o.status = 'refunded'
      ORDER BY o.created_at ASC`,
  );

  const candidates: Candidate[] = result.rows.map((row) => ({
    orderId: String(row.order_id),
    userId: String(row.user_id),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    enrollmentOrderId: row.enrollment_order_id ? String(row.enrollment_order_id) : null,
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    paymentAmountMinor: Number(row.payment_amount_minor) || 0,
    processedRefundMinor: Number(row.processed_refund_minor) || 0,
    pendingRefundMinor: Number(row.pending_refund_minor) || 0,
    lastProcessedRefundId: row.last_processed_refund_id ? String(row.last_processed_refund_id) : null,
    commerceStatus: row.commerce_status ? String(row.commerce_status) : null,
  }));

  let enqueue = 0;
  let skipped = 0;
  for (const c of candidates) {
    const label = `${c.orderId} (payment ${c.razorpayPaymentId ?? "?"}, enrolment order ${c.enrollmentOrderId ?? "?"})`;
    let reason: string | null = null;
    if (!c.enrollmentOrderId || !c.workspaceId || !c.razorpayPaymentId) reason = "missing enrolment/workspace/payment reference";
    else if (c.processedRefundMinor < c.paymentAmountMinor) {
      reason = `processed refunds ${c.processedRefundMinor} < paid ${c.paymentAmountMinor}` +
        (c.pendingRefundMinor > 0 ? ` (pending ${c.pendingRefundMinor} — settle it first)` : "");
    } else if (c.commerceStatus !== "paid") reason = `commerce order is ${c.commerceStatus ?? "missing"}`;

    if (reason) {
      skipped += 1;
      console.log(`[skip] ${label}: ${reason}`);
      continue;
    }
    enqueue += 1;
    console.log(`[${apply ? "enqueue" : "would enqueue"}] ${label} workspace ${c.workspaceId}`);
    if (apply) {
      await enqueueOutbox({
        id: `institute_enrollment_refund_${c.razorpayPaymentId}`,
        kind: "institute_enrollment_revoke",
        payload: {
          userId: c.userId,
          orderId: c.orderId,
          enrollmentOrderId: c.enrollmentOrderId,
          workspaceId: c.workspaceId,
          refundId: c.lastProcessedRefundId ?? `backfill_${c.razorpayPaymentId}`,
          paymentId: c.razorpayPaymentId,
          source: "backfill-institute-refund-teardown",
        },
      });
    }
  }

  console.log(
    `[institute refund teardown] ${candidates.length} refunded institute order(s); ` +
      `${enqueue} ${apply ? "enqueued" : "to enqueue"}, ${skipped} skipped.` +
      (apply ? " The outbox drain applies them on its next tick." : " Dry run — re-run with --apply to enqueue."),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[institute refund teardown] failed", error);
  process.exit(1);
});
