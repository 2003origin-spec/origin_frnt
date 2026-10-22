/**
 * The per-user payments lock: `pg_advisory_xact_lock(hashtext(<user id>))`.
 *
 * CANONICAL LOCK ORDER (bug-fix F5). Every transaction that takes this lock
 * AND row locks on the payments tables must take them in this order:
 *
 *   1. this user advisory lock           — FIRST, before any row lock
 *   2. payments.orders rows               (FOR UPDATE / UPDATE)
 *   3. payments.payments rows             (FOR UPDATE / UPDATE)
 *   4. payments.refunds, pricing.coupons, entitlements.subject_grants rows
 *
 * Step 1 is what matters: once two transactions for the same student both
 * queue on the advisory lock first, they run one after the other and their
 * row locks cannot interleave. Taking a row lock first and the advisory lock
 * second (what `applyPaymentSuccess` used to do) waits on the lock while
 * holding the row, and a checkout holding the lock then waits on that row:
 * Postgres aborts one side with 40P01 (deadlock), surfaced as a 503.
 *
 * Paths that hold it:
 *   - `createCheckoutOrder` (institute offering: open-order lookup, supersede, insert)
 *   - `applyPaymentSuccess` (verify + webhook capture)
 *   - `applyRefundInTransaction` (refund → order status → grant revoke/rebase)
 *     and `initiateRefund`, via `lockUserPaymentsForPayment` because they
 *     start from a payment id
 *   - `grants.ts` writers (re-entrant: their callers already hold it)
 *   - Origin NOW premium redemption (`now/store-service.ts`, same key)
 *
 * The lock is transaction-scoped and re-entrant within one transaction, so a
 * helper taking it again under a caller that holds it is a no-op.
 */

type Exec = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

export const USER_PAYMENT_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext($1))";

/** Takes the per-user payments lock inside the caller's transaction. */
export async function lockUserPayments(exec: Exec, userId: string): Promise<void> {
  await exec.query(USER_PAYMENT_LOCK_SQL, [userId]);
}

/**
 * Takes the same per-user lock for the user who owns a payment, WITHOUT row
 * locking the payment (a plain SELECT), so the caller can take the payment
 * row lock afterwards in canonical order. `payments.user_id` never changes
 * after insert, so reading it unlocked is safe. No row (or a NULL user) takes
 * no lock; the caller's own lookup then decides what an unknown payment means.
 */
export async function lockUserPaymentsForPayment(exec: Exec, razorpayPaymentId: string): Promise<void> {
  await exec.query(
    `SELECT pg_advisory_xact_lock(hashtext(user_id))
       FROM payments.payments
      WHERE razorpay_payment_id = $1 AND user_id IS NOT NULL`,
    [razorpayPaymentId],
  );
}
