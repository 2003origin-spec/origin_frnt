/** Refund and dispute lifecycle for the unified payments ledger (Phase 7). */

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { metric } from "@/lib/metrics";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { reverseCoinPackOnRefund } from "@/server/now/coin-pack-payments";
import { getUserPostgresPool } from "@/server/user-postgres";
import type { AuditEventInput } from "@/server/workspaces/types";

import { enqueueAdminAlerts } from "./admin-alerts";
import { rebasePaidGrantExpiriesForSubject } from "./grants";
import { lockUserPaymentsForPayment } from "./user-payment-lock";
import {
  enqueueOutbox,
  getPaymentById,
  insertRefund,
  markPaymentDisputed,
  setOrderStatus,
  type PaymentRecord,
} from "./payments-store";
import { ensurePaymentsAndGrantSchema } from "./payments-schema";
import { publishOutbox } from "./qstash";
import { getRazorpayClient } from "./razorpay-client";

export const REFUND_WINDOW_DAYS = 7;
const REFUND_WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export class PaymentLifecycleError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PaymentLifecycleError";
    this.status = status;
  }
}

export type RefundValidationInput = Pick<
  PaymentRecord,
  "status" | "amountMinor" | "amountRefundedMinor" | "capturedAt"
> & {
  /** Initiated-but-unprocessed refunds; they reserve refundable headroom. */
  pendingRefundMinor?: number | null;
  requestedAmountMinor?: number | null;
  now?: Date;
};

export type RefundValidation = {
  amountMinor: number;
  remainingMinor: number;
  isFull: boolean;
  windowEndsAt: string;
};

/** Pure server-side refund guard used by the route and unit tests. */
export function validateRefundRequest(input: RefundValidationInput): RefundValidation {
  if (input.status !== "captured") {
    throw new PaymentLifecycleError(409, "Only captured payments can be refunded.");
  }
  const capturedAt = input.capturedAt ? new Date(input.capturedAt) : null;
  if (!capturedAt || !Number.isFinite(capturedAt.getTime())) {
    throw new PaymentLifecycleError(409, "The payment has no valid capture time.");
  }
  const now = input.now ?? new Date();
  const windowEnds = new Date(capturedAt.getTime() + REFUND_WINDOW_MS);
  if (now.getTime() > windowEnds.getTime()) {
    throw new PaymentLifecycleError(409, `The ${REFUND_WINDOW_DAYS}-day refund window has expired.`);
  }

  const remainingMinor = Math.max(
    0,
    input.amountMinor - input.amountRefundedMinor - Math.max(0, input.pendingRefundMinor ?? 0),
  );
  if (remainingMinor <= 0) {
    throw new PaymentLifecycleError(409, "This payment has no refundable amount remaining.");
  }
  if (
    input.requestedAmountMinor != null &&
    (!Number.isFinite(input.requestedAmountMinor) ||
      !Number.isInteger(input.requestedAmountMinor) ||
      input.requestedAmountMinor <= 0)
  ) {
    throw new PaymentLifecycleError(400, "Refund amount must be a positive integer in paise.");
  }
  const amountMinor = input.requestedAmountMinor ?? remainingMinor;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new PaymentLifecycleError(400, "Refund amount must be a positive integer in paise.");
  }
  if (amountMinor > remainingMinor) {
    throw new PaymentLifecycleError(409, "Refund amount exceeds the remaining refundable amount.");
  }
  return {
    amountMinor,
    remainingMinor,
    isFull: amountMinor === remainingMinor,
    windowEndsAt: windowEnds.toISOString(),
  };
}

export type RazorpayRefundAdapter = {
  payments: {
    refund(
      razorpayPaymentId: string,
      input: { amount: number; speed?: "normal" | "optimum"; notes?: Record<string, string> },
    ): Promise<Record<string, unknown>>;
    /**
     * `GET /payments/:id/refunds` — resolves an `unknown` refund intent before
     * another refund may be created. Optional so older stubs type-check; the
     * real SDK always has it (and without it an unknown intent stays blocking).
     */
    fetchMultipleRefund?(
      razorpayPaymentId: string,
      params?: { count?: number; skip?: number },
    ): Promise<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
  };
};

/**
 * True only when Razorpay definitely created NO refund: an HTTP 4xx answer from
 * the API (validation, auth, over-refund, rate limit). A timeout, a network
 * error, a 5xx (or 408), and a 2xx answer our own checks rejected are all
 * ambiguous: the refund may exist.
 */
export function isDefiniteRefundRejection(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408;
}

/**
 * Where a refund is in Razorpay's lifecycle. Money is "returned" — and access
 * revoked — only at `processed`. `pending` covers Razorpay's `created`/`pending`
 * (and anything unknown): the student keeps access while the money is still
 * with Origin. `failed` means the money never left.
 */
export type RefundPhase = "pending" | "processed" | "failed";

export function refundPhaseOf(status: string | null | undefined): RefundPhase {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "processed") return "processed";
  if (normalized === "failed") return "failed";
  return "pending";
}

/**
 * Ledger status after applying `incoming` on top of what is stored. A processed
 * refund never regresses (out-of-order `refund.created`, or a rare Razorpay
 * reversal that is alerted instead), and a late `pending` never reopens a
 * terminal `failed`.
 */
export function mergeRefundPhase(previous: RefundPhase | null, incoming: RefundPhase): RefundPhase {
  if (previous === "processed" || incoming === "processed") return "processed";
  if (previous === "failed" || incoming === "failed") return "failed";
  return "pending";
}

export type RefundLifecycleInput = {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountMinor: number;
  /** Razorpay refund status (`pending` | `processed` | `failed`); unknown → pending. */
  status?: string | null;
  reason?: string | null;
  initiatedBy?: string | null;
  raw?: Record<string, unknown>;
  createdAt?: Date | null;
};

export type RefundLifecycleResult = {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  orderId: string | null;
  userId: string | null;
  amountMinor: number;
  amountRefundedMinor: number;
  remainingMinor: number;
  isFull: boolean;
  orderStatus: "partially_refunded" | "refunded" | null;
  alreadyApplied: boolean;
  revokedGrantCount: number;
  /** Ledger status of this refund after the call. */
  phase: RefundPhase;
};

export type RefundTxnResult = RefundLifecycleResult & {
  recomputeUserId: string | null;
  outboxIds: string[];
  /** A refund Razorpay reported failed AFTER it was processed (manual review). */
  reversal: boolean;
};

function pool() {
  const value = getUserPostgresPool();
  if (!value) throw new Error("USER_DATABASE_URL is not configured");
  return value;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function integer(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function epochDate(value: unknown): Date | null {
  const seconds = integer(value);
  if (seconds == null) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

async function recipient(client: PoolClient, userId: string | null) {
  if (!userId) return { email: null, name: null };
  const result = await client.query(`SELECT email, name FROM origin_users WHERE id = $1`, [userId]);
  return {
    email: text(result.rows[0]?.email),
    name: text(result.rows[0]?.name),
  };
}

function rupees(minor: number): string {
  return `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Applies one refund observation inside the caller's transaction.
 *
 * Exported for the unit suite (driven with a scripted client); production
 * callers go through `applyRefundLifecycle` / `initiateRefund`.
 */
export async function applyRefundInTransaction(
  input: RefundLifecycleInput,
  client: PoolClient,
): Promise<RefundTxnResult> {
  if (!input.razorpayRefundId.trim()) throw new PaymentLifecycleError(400, "Refund id is required.");
  if (!input.razorpayPaymentId.trim()) throw new PaymentLifecycleError(400, "Payment id is required.");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new PaymentLifecycleError(400, "Refund amount must be a positive integer in paise.");
  }

  // Canonical lock order (user-payment-lock.ts): the owner's user lock FIRST,
  // then the payment / order rows. The grant rebase below takes the same lock,
  // so taking it only there (after the row locks) could deadlock against a
  // capture or checkout for the same student (bug-fix F5).
  await lockUserPaymentsForPayment(client, input.razorpayPaymentId);
  const paymentResult = await client.query(
    `SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
    [input.razorpayPaymentId],
  );
  const payment = paymentResult.rows[0] as Record<string, unknown> | undefined;
  if (!payment) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
  const paymentAmount = Number(payment.amount_minor) || 0;

  const existing = await client.query(
    `SELECT razorpay_payment_id, status FROM payments.refunds WHERE razorpay_refund_id = $1 FOR UPDATE`,
    [input.razorpayRefundId],
  );
  const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
  if (existingRow && String(existingRow.razorpay_payment_id) !== input.razorpayPaymentId) {
    throw new PaymentLifecycleError(409, "Refund id is already linked to a different payment.");
  }

  const incoming = refundPhaseOf(input.status);
  const previous = existingRow ? refundPhaseOf(text(existingRow.status)) : null;
  const phase = mergeRefundPhase(previous, incoming);
  const reversal = previous === "processed" && incoming === "failed";

  // A new refund must fit in the headroom left by refunds that are processed
  // OR still in flight; a failed refund moved no money and reserves nothing.
  if (!existingRow && incoming !== "failed") {
    const committed = await client.query(
      `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total
         FROM payments.refunds
        WHERE razorpay_payment_id = $1 AND status IN ('pending', 'processed')`,
      [input.razorpayPaymentId],
    );
    const reserved = Math.max(
      Number(committed.rows[0]?.total) || 0,
      Number(payment.amount_refunded_minor) || 0,
    );
    if (input.amountMinor > Math.max(0, paymentAmount - reserved)) {
      throw new PaymentLifecycleError(409, "Refund amount exceeds the remaining refundable amount.");
    }
  }

  const write = await insertRefund(
    {
      razorpayRefundId: input.razorpayRefundId,
      razorpayPaymentId: input.razorpayPaymentId,
      amountMinor: input.amountMinor,
      isFull: false,
      status: phase,
      reason: input.reason ?? null,
      initiatedBy: input.initiatedBy ?? null,
      livemode: Boolean(payment.livemode),
      raw: input.raw ?? {},
    },
    client,
  );

  // Only processed refunds are money returned.
  const totalResult = await client.query(
    `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total
       FROM payments.refunds WHERE razorpay_payment_id = $1 AND status = 'processed'`,
    [input.razorpayPaymentId],
  );
  const amountRefundedMinor = Math.min(paymentAmount, Number(totalResult.rows[0]?.total) || 0);
  const isFull = amountRefundedMinor >= paymentAmount;

  const orderId = text(payment.order_id);
  const userId = text(payment.user_id);
  let revokedGrantCount = 0;
  const outboxIds: string[] = [];

  // `notes.refund_pending` marks an order whose refund is in flight (no DDL):
  // set to the newest still-pending refund id, removed once none is pending.
  if (orderId) {
    const pendingRow = await client.query(
      `SELECT razorpay_refund_id FROM payments.refunds
        WHERE razorpay_payment_id = $1 AND status = 'pending'
        ORDER BY created_at DESC, razorpay_refund_id DESC LIMIT 1`,
      [input.razorpayPaymentId],
    );
    const pendingRefundId = text(pendingRow.rows[0]?.razorpay_refund_id);
    if (pendingRefundId) {
      await client.query(
        `UPDATE payments.orders
            SET notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object('refund_pending', $2::text),
                updated_at = NOW()
          WHERE id = $1`,
        [orderId, pendingRefundId],
      );
    } else {
      await client.query(
        `UPDATE payments.orders
            SET notes = COALESCE(notes, '{}'::jsonb) - 'refund_pending',
                updated_at = NOW()
          WHERE id = $1 AND COALESCE(notes, '{}'::jsonb) ? 'refund_pending'`,
        [orderId],
      );
    }
  }

  if (phase === "processed") {
    await client.query(
      `UPDATE payments.refunds SET is_full = $2 WHERE razorpay_refund_id = $1`,
      [input.razorpayRefundId, isFull],
    );
    await client.query(
      `UPDATE payments.payments
          SET amount_refunded_minor = GREATEST(amount_refunded_minor, $2),
              status = CASE WHEN $3 THEN 'refunded' ELSE status END
        WHERE razorpay_payment_id = $1`,
      [input.razorpayPaymentId, amountRefundedMinor, isFull],
    );

    let orderKind: string | null = null;
    if (orderId) {
      const orderStatus = isFull ? "refunded" : "partially_refunded";
      await setOrderStatus(orderId, orderStatus, undefined, client);
      if (isFull) {
        const orderRow = await client.query(
          `SELECT kind::text AS kind, notes, workspace_id FROM payments.orders WHERE id = $1`,
          [orderId],
        );
        orderKind = text(orderRow.rows[0]?.kind);
        const notes = (orderRow.rows[0]?.notes as Record<string, unknown> | undefined) ?? {};
        // Origin NOW coin packs: take back the coins still spendable; a spent
        // shortfall freezes the wallet for review instead of failing the refund.
        if (orderKind === "coin_pack" && userId) {
          await reverseCoinPackOnRefund(client, { id: orderId, userId, notes });
        }
        const revoked = await client.query(
          `UPDATE entitlements.subject_grants
              SET status = 'revoked', updated_at = NOW()
            WHERE order_id = $1 AND source = 'paid_order' AND status = 'active'
            RETURNING user_id, subject`,
          [orderId],
        );
        revokedGrantCount = revoked.rowCount ?? 0;
        const subjects = Array.from(new Set(revoked.rows.map((row) => String(row.subject))));
        for (const subject of subjects) {
          if (userId) {
            await rebasePaidGrantExpiriesForSubject({ userId, subject, client });
          }
        }
        // Institute offerings: the access lives in the workspace enrolment, not
        // in subject grants. Tear it down through the outbox (mirror of the
        // `institute_enrollment` row the capture enqueued). Partial refunds
        // keep the enrolment. A duplicate capture (P5: `notes.duplicate_of`,
        // refunded by the `duplicate_capture_refund` action) shares the
        // original order's enrolment order but never bought the seat, so its
        // refund must not tear down the access the original payment holds.
        if (orderKind === "institute_offering" && !text(notes.duplicate_of)) {
          const enrollmentOrderId = text(notes.enrollment_order_id);
          const workspaceId = text(orderRow.rows[0]?.workspace_id);
          if (enrollmentOrderId && workspaceId) {
            const id = `institute_enrollment_refund_${input.razorpayPaymentId}`;
            await enqueueOutbox(
              {
                id,
                kind: "institute_enrollment_revoke",
                payload: {
                  userId,
                  orderId,
                  enrollmentOrderId,
                  workspaceId,
                  refundId: input.razorpayRefundId,
                  paymentId: input.razorpayPaymentId,
                },
              },
              client,
            );
            outboxIds.push(id);
          } else {
            outboxIds.push(
              ...(await enqueueAdminAlerts(client, {
                idPrefix: `payment_refund_institute_unlinked_${input.razorpayPaymentId}`,
                title: "Institute refund needs manual teardown",
                message: `${orderId} was fully refunded but has no enrolment order reference. Remove the student's paid enrolment by hand.`,
              })),
            );
          }
        }
      }
    }

    if (isFull && userId) {
      const target = await recipient(client, userId);
      const id = `payment_refund_full_${input.razorpayPaymentId}`;
      await enqueueOutbox(
        {
          id,
          kind: "refund_email",
          payload: {
            userId,
            to: target.email,
            studentName: target.name,
            orderId,
            paymentId: input.razorpayPaymentId,
            refundId: input.razorpayRefundId,
            amountMinor: paymentAmount,
            refundAmountMinor: amountRefundedMinor,
            currency: text(payment.currency) ?? "INR",
            isFull: true,
            refundReason: input.reason ?? null,
            href: orderKind === "institute_offering" ? "/connect" : "/premium",
          },
        },
        client,
      );
      outboxIds.push(id);
    } else if (!isFull) {
      outboxIds.push(
        ...(await enqueueAdminAlerts(client, {
          idPrefix: `payment_refund_partial_${input.razorpayRefundId}`,
          title: "Partial payment refund",
          message: `${input.razorpayPaymentId} was partially refunded. Student access remains active.`,
        })),
      );
    }

    if (reversal) {
      outboxIds.push(
        ...(await enqueueAdminAlerts(client, {
          idPrefix: `payment_refund_reversal_${input.razorpayRefundId}`,
          title: "Refund reversal — manual review",
          message: `${input.razorpayPaymentId}: Razorpay reported refund ${input.razorpayRefundId} failed after it was processed. The ledger still shows it processed and access was not restored.`,
        })),
      );
    }
  } else if (phase === "pending") {
    outboxIds.push(
      ...(await enqueueAdminAlerts(client, {
        idPrefix: `payment_refund_pending_${input.razorpayRefundId}`,
        title: "Refund initiated",
        message: `${input.razorpayPaymentId}: ${rupees(input.amountMinor)} refund ${input.razorpayRefundId} is with Razorpay. Student access stays active until Razorpay processes it.`,
      })),
    );
  } else {
    outboxIds.push(
      ...(await enqueueAdminAlerts(client, {
        idPrefix: `payment_refund_failed_${input.razorpayRefundId}`,
        title: "Refund FAILED",
        message: `${input.razorpayPaymentId}: Razorpay could not return ${rupees(input.amountMinor)} (refund ${input.razorpayRefundId}) — the money is still with Origin and access is unchanged; retry from /admin/financials.`,
      })),
    );
  }

  const processedOrderStatus = isFull ? "refunded" : "partially_refunded";
  return {
    razorpayRefundId: input.razorpayRefundId,
    razorpayPaymentId: input.razorpayPaymentId,
    orderId,
    userId,
    amountMinor: input.amountMinor,
    amountRefundedMinor,
    remainingMinor: Math.max(0, paymentAmount - amountRefundedMinor),
    isFull,
    orderStatus: orderId && phase === "processed" ? processedOrderStatus : null,
    alreadyApplied: !write.inserted && previous === phase && !reversal,
    revokedGrantCount,
    phase,
    recomputeUserId: phase === "processed" && isFull && orderId ? userId : null,
    outboxIds,
    reversal,
  };
}

async function runPostCommit(result: RefundTxnResult): Promise<void> {
  if (result.recomputeUserId) await recomputeUserPremiumFlags(result.recomputeUserId);
  await Promise.all(result.outboxIds.map((id) => publishOutbox(id).catch(() => undefined)));
  const source = result.alreadyApplied ? "duplicate" : "new";
  if (result.reversal) metric("origin.payments.refund.reversal", { source });
  if (result.phase === "processed") {
    metric(result.isFull ? "origin.payments.refund.full" : "origin.payments.refund.partial", { source });
  } else {
    metric(`origin.payments.refund.${result.phase}`, { source });
  }
}

function publicRefundResult(result: RefundTxnResult): RefundLifecycleResult {
  return {
    razorpayRefundId: result.razorpayRefundId,
    razorpayPaymentId: result.razorpayPaymentId,
    orderId: result.orderId,
    userId: result.userId,
    amountMinor: result.amountMinor,
    amountRefundedMinor: result.amountRefundedMinor,
    remainingMinor: result.remainingMinor,
    isFull: result.isFull,
    orderStatus: result.orderStatus,
    alreadyApplied: result.alreadyApplied,
    revokedGrantCount: result.revokedGrantCount,
    phase: result.phase,
  };
}

/** Shared idempotent path for admin and refund webhook events. */
export async function applyRefundLifecycle(input: RefundLifecycleInput, db?: RefundDb): Promise<RefundLifecycleResult> {
  await ensurePaymentsAndGrantSchema();
  const client = await (db ?? pool()).connect();
  let result: RefundTxnResult;
  try {
    await client.query("BEGIN");
    result = await applyRefundInTransaction(input, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await runPostCommit(result);
  return publicRefundResult(result);
}

/**
 * How long a recorded refund intent blocks another initiation for the same
 * payment. Long enough for the Razorpay call plus its `refund.created` webhook
 * to land (after which the pending refund itself reserves the headroom), short
 * enough that an intent orphaned by a crashed lambda does not block an admin
 * for long.
 */
export const REFUND_INTENT_TTL_MS = 10 * 60 * 1000;

/**
 * How old an intent must be before a Razorpay refund lookup that does not
 * list it is taken to mean "no refund was created". Some ambiguous answers (a
 * 502/504 from Razorpay's load balancer, a connection reset after the request
 * went out) come back BEFORE Razorpay has finished creating the refund, so an
 * empty lookup seconds later proves nothing; dropping the intent then would
 * let a retry send a second (partial) refund. Ten minutes is far beyond any
 * Razorpay create latency. Until then a retry is refused with a 409 and the
 * payments reconcile keeps re-checking the intent.
 */
export const REFUND_INTENT_SETTLE_MS = 10 * 60 * 1000;

type RefundDb = { connect(): Promise<PoolClient> };

/**
 * Admin initiation, in three steps so NO lock (and no pool connection) is held
 * across the Razorpay HTTP call:
 *
 *   1. short transaction: row-lock the payment, refuse if another initiation
 *      is in flight, validate, and record the intent in
 *      `payments.refund_intents` (one row per payment) — COMMIT;
 *   2. call Razorpay with nothing held;
 *   3. short transaction: record the refund (`applyRefundInTransaction`, which
 *      re-takes its own locks in canonical order) and clear the intent.
 *
 * The intent row is what the old held lock did: two admins clicking Refund on
 * the same payment cannot both pass validation. A slow Razorpay call used to
 * stall every payment transaction for that user/payment while holding a pool
 * connection. If step 3 fails after Razorpay accepted the refund, the
 * `refund.*` webhook (or the reconcile) records it; the intent keeps blocking
 * a duplicate initiation until then (REFUND_INTENT_TTL_MS).
 *
 * An AMBIGUOUS Razorpay outcome in step 2 (timeout, network error, 5xx, or an
 * answer that failed our checks) may still have created the refund, so the
 * intent is NOT cleared: it is marked `unknown`. Before any later initiation
 * for that payment may create a refund, the intent is resolved against
 * Razorpay (`checkRefundIntent`: the payment's refunds are fetched and
 * recorded). If the earlier attempt did create a refund, the new initiation is
 * refused. If Razorpay lists no such refund, the intent is dropped and the
 * initiation proceeds ONLY once the intent is older than
 * REFUND_INTENT_SETTLE_MS; before that the initiation is refused (409) while
 * the outcome settles. Only a definite 4xx rejection clears the intent at
 * once. A `sending` intent older than the TTL (a crashed lambda) is resolved
 * the same way. An admin can abandon an intent that stays stuck
 * (`abandonRefundIntent`).
 *
 * Access ends when Razorpay PROCESSES the refund, not here.
 */
export async function initiateRefund(input: {
  razorpayPaymentId: string;
  amountMinor?: number | null;
  reason?: string | null;
  initiatedBy: string;
  now?: Date;
  razorpayClient?: RazorpayRefundAdapter;
  /** Test seam; defaults to the USER pool. */
  db?: RefundDb;
}): Promise<RefundLifecycleResult & { windowEndsAt: string }> {
  await ensurePaymentsAndGrantSchema();
  const db: RefundDb = input.db ?? pool();
  const intentId = `rfi_${randomUUID()}`;
  const gateway = () => input.razorpayClient ?? (getRazorpayClient() as unknown as RazorpayRefundAdapter);

  // 0. An earlier attempt with an unknown outcome is settled first (no lock held).
  const earlier = await checkRefundIntent(db, input.razorpayPaymentId, gateway);
  if (earlier.outcome === "no_refund") {
    await clearRefundIntent(db, input.razorpayPaymentId, earlier.intent.intentId);
    metric("origin.payments.refund.intent_resolved", { outcome: "no_refund" });
  } else if (earlier.outcome !== "none") {
    throw refusalForEarlierIntent(earlier);
  }

  // 1. Validate + record intent (short transaction).
  let validation: RefundValidation;
  {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Canonical lock order (user-payment-lock.ts): the owner's user lock
      // FIRST, then the payment row. Held only for this short transaction,
      // never across the Razorpay call (step 2); step 3 re-takes it through
      // applyRefundInTransaction.
      await lockUserPaymentsForPayment(client, input.razorpayPaymentId);
      const row = await client.query(
        `SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
        [input.razorpayPaymentId],
      );
      if (!row.rows[0]) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
      const inFlight = await client.query(
        `SELECT intent_id, state FROM payments.refund_intents
          WHERE razorpay_payment_id = $1 AND abandoned_at IS NULL
            AND (state = 'unknown' OR created_at > NOW() - make_interval(secs => $2))`,
        [input.razorpayPaymentId, REFUND_INTENT_TTL_MS / 1000],
      );
      if (inFlight.rows[0]) {
        throw new PaymentLifecycleError(
          409,
          inFlight.rows[0].state === "unknown"
            ? "An earlier refund attempt for this payment has an unknown outcome and could not be checked yet. Try again in a minute."
            : "A refund for this payment is already being sent to Razorpay. Check the refunds list in a minute before retrying.",
        );
      }
      const payment = await getPaymentById(input.razorpayPaymentId, client);
      if (!payment) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
      validation = validateRefundRequest({
        ...payment,
        requestedAmountMinor: input.amountMinor,
        now: input.now,
      });
      await client.query(
        `INSERT INTO payments.refund_intents (razorpay_payment_id, intent_id, amount_minor, initiated_by, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (razorpay_payment_id) DO UPDATE
           SET intent_id = EXCLUDED.intent_id,
               amount_minor = EXCLUDED.amount_minor,
               initiated_by = EXCLUDED.initiated_by,
               created_at = EXCLUDED.created_at,
               state = 'sending',
               abandoned_at = NULL,
               abandoned_by = NULL`,
        [input.razorpayPaymentId, intentId, validation.amountMinor, input.initiatedBy],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  // 2. Razorpay, with no lock and no connection held.
  let external: Record<string, unknown>;
  let refundId: string | null;
  let externalAmount: number;
  try {
    external = await gateway().payments.refund(input.razorpayPaymentId, {
      amount: validation.amountMinor,
      speed: "normal",
      notes: {
        origin_intent_id: intentId,
        origin_initiated_by: input.initiatedBy,
        ...(input.reason ? { origin_reason: input.reason.slice(0, 200) } : {}),
      },
    });
    refundId = text(external.id);
    if (!refundId) throw new PaymentLifecycleError(502, "Razorpay did not return a refund id.");
    externalAmount = integer(external.amount) ?? validation.amountMinor;
    if (externalAmount <= 0 || externalAmount > validation.remainingMinor) {
      throw new PaymentLifecycleError(502, "Razorpay returned an invalid refund amount.");
    }
  } catch (error) {
    if (isDefiniteRefundRejection(error)) {
      // Razorpay refused it: no refund exists, so free the payment right away.
      await clearRefundIntent(db, input.razorpayPaymentId, intentId);
      throw error;
    }
    // The refund may exist. Keep blocking until it is checked against Razorpay.
    await markRefundIntentUnknown(db, input.razorpayPaymentId, intentId);
    metric("origin.payments.refund.ambiguous", { source: "initiate" });
    console.error(
      `[refunds] ambiguous Razorpay answer for a refund of ${input.razorpayPaymentId}; intent ${intentId} kept as unknown`,
      error,
    );
    const detail = error instanceof Error ? error.message : String(error);
    throw new PaymentLifecycleError(
      502,
      `Razorpay did not give a clear answer (${detail}), so the refund may or may not have been created. ` +
        "It will be checked against Razorpay before another refund can be sent for this payment.",
    );
  }

  // 3. Record the refund + clear the intent (short transaction).
  //    applyRefundInTransaction takes the user lock before any row lock.
  let result: RefundTxnResult;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    result = await applyRefundInTransaction(
      {
        razorpayRefundId: refundId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountMinor: externalAmount,
        // Razorpay answers a normal-speed refund with `pending`; access is
        // revoked when `refund.processed` lands (or the 24 h reconcile sees it).
        // An instant refund that is already `processed` revokes right here.
        status: text(external.status) ?? "pending",
        reason: input.reason ?? null,
        initiatedBy: input.initiatedBy,
        raw: external,
        createdAt: epochDate(external.created_at),
      },
      client,
    );
    await client.query(
      `DELETE FROM payments.refund_intents WHERE razorpay_payment_id = $1 AND intent_id = $2`,
      [input.razorpayPaymentId, intentId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(
      `[refunds] Razorpay accepted refund ${refundId} for ${input.razorpayPaymentId} but recording it failed; ` +
        "the refund webhook / reconcile will apply it",
      error,
    );
    metric("origin.payments.refund.record_failed", { source: "initiate" });
    throw error;
  } finally {
    client.release();
  }
  await runPostCommit(result);
  return { ...publicRefundResult(result), windowEndsAt: validation.windowEndsAt };
}

/** Best-effort: marks OUR intent `unknown` so it blocks until checkRefundIntent settles it. */
async function markRefundIntentUnknown(db: RefundDb, razorpayPaymentId: string, intentId: string): Promise<void> {
  const client = await db.connect().catch(() => null);
  if (!client) return; // stays `sending`; once past the TTL it is resolved the same way
  try {
    await client.query(
      `UPDATE payments.refund_intents SET state = 'unknown' WHERE razorpay_payment_id = $1 AND intent_id = $2`,
      [razorpayPaymentId, intentId],
    );
  } catch (error) {
    console.error("[refunds] could not mark refund intent unknown; it is resolved once past its TTL", error);
  } finally {
    client.release();
  }
}

function refundItems(
  value: { items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null | undefined,
): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.items) ? value.items : [];
}

/** An intent that may need checking against Razorpay (not abandoned). */
type OpenRefundIntent = {
  intentId: string;
  amountMinor: number;
  state: string;
  initiatedBy: string | null;
  createdAt: Date;
  /** Older than REFUND_INTENT_SETTLE_MS (by the database clock). */
  pastSettle: boolean;
};

/**
 * What a Razorpay lookup says about a payment's open refund intent:
 *  - `none`: no intent needs checking;
 *  - `refund_found`: Razorpay lists the intent's refund; it is now recorded and
 *    the intent cleared;
 *  - `settling`: Razorpay lists no such refund YET, and the intent is still
 *    inside the settle window (kept, keeps blocking);
 *  - `no_refund`: Razorpay lists no such refund and the settle window has
 *    passed (the caller drops or abandons the intent);
 *  - `unresolved`: Razorpay could not be asked, or a listed refund could not
 *    be recorded (kept, keeps blocking).
 */
export type RefundIntentCheck =
  | { outcome: "none" }
  | { outcome: "refund_found"; intent: OpenRefundIntent; refundId: string; checked: number }
  | { outcome: "settling"; intent: OpenRefundIntent; settlesAt: string; checked: number }
  | { outcome: "no_refund"; intent: OpenRefundIntent; checked: number }
  | { outcome: "unresolved"; intent: OpenRefundIntent; reason: "fetch_failed" | "record_failed"; refundId: string | null };

async function loadOpenRefundIntent(db: RefundDb, razorpayPaymentId: string): Promise<OpenRefundIntent | null> {
  const client = await db.connect();
  try {
    const row = await client.query(
      `SELECT intent_id, state, amount_minor, initiated_by, created_at,
              (created_at <= NOW() - make_interval(secs => $3)) AS past_settle
         FROM payments.refund_intents
        WHERE razorpay_payment_id = $1 AND abandoned_at IS NULL
          AND (state = 'unknown' OR created_at <= NOW() - make_interval(secs => $2))`,
      [razorpayPaymentId, REFUND_INTENT_TTL_MS / 1000, REFUND_INTENT_SETTLE_MS / 1000],
    );
    const r = row.rows[0];
    if (!r) return null;
    return {
      intentId: String(r.intent_id),
      amountMinor: Number(r.amount_minor),
      state: String(r.state),
      initiatedBy: text(r.initiated_by),
      createdAt: new Date(r.created_at),
      pastSettle: Boolean(r.past_settle),
    };
  } finally {
    client.release();
  }
}

/**
 * The reconcile step for an intent whose outcome is unknown (`state =
 * 'unknown'`, or a `sending` intent older than the TTL). With no lock held,
 * fetches the payment's refunds from Razorpay and records each one through
 * the idempotent lifecycle path (so pending refunds reserve headroom). A
 * refund came from the intent when its `origin_intent_id` note names it; a
 * refund with no such note (created before the note existed, or by hand)
 * matches on the same amount created at or after the intent. A found refund
 * clears the intent. "No refund" is concluded only once the intent is older
 * than REFUND_INTENT_SETTLE_MS; the caller then drops or abandons it.
 */
async function checkRefundIntent(
  db: RefundDb,
  razorpayPaymentId: string,
  gateway: () => RazorpayRefundAdapter,
): Promise<RefundIntentCheck> {
  const intent = await loadOpenRefundIntent(db, razorpayPaymentId);
  if (!intent) return { outcome: "none" };

  let items: Array<Record<string, unknown>>;
  try {
    const adapter = gateway();
    if (!adapter.payments.fetchMultipleRefund) throw new Error("refund lookup unavailable");
    items = refundItems(await adapter.payments.fetchMultipleRefund(razorpayPaymentId, { count: 100 }));
  } catch (error) {
    metric("origin.payments.refund.intent_unresolved", { reason: "fetch_failed" });
    console.error(`[refunds] could not resolve refund intent ${intent.intentId} for ${razorpayPaymentId}`, error);
    return { outcome: "unresolved", intent, reason: "fetch_failed", refundId: null };
  }

  const refunds: Array<{
    id: string;
    amountMinor: number;
    originIntentId: string | null;
    createdAt: Date | null;
    raw: Record<string, unknown>;
  }> = [];
  for (const refund of items) {
    const id = text(refund.id);
    const amountMinor = integer(refund.amount);
    if (!id || !amountMinor || amountMinor <= 0) continue;
    const paymentId = text(refund.payment_id);
    if (paymentId && paymentId !== razorpayPaymentId) continue;
    const notes = refund.notes && typeof refund.notes === "object" ? (refund.notes as Record<string, unknown>) : {};
    refunds.push({ id, amountMinor, originIntentId: text(notes.origin_intent_id), createdAt: epochDate(refund.created_at), raw: refund });
  }

  for (const refund of refunds) {
    try {
      await applyRefundLifecycle(
        {
          razorpayRefundId: refund.id,
          razorpayPaymentId,
          amountMinor: refund.amountMinor,
          status: text(refund.raw.status) ?? "pending",
          raw: { origin: "refund_intent_reconcile", refund: refund.raw },
          createdAt: refund.createdAt,
        },
        db,
      );
    } catch (error) {
      metric("origin.payments.refund.intent_unresolved", { reason: "record_failed" });
      console.error(
        `[refunds] could not record Razorpay refund ${refund.id} for ${razorpayPaymentId} while resolving ${intent.intentId}`,
        error,
      );
      return { outcome: "unresolved", intent, reason: "record_failed", refundId: refund.id };
    }
  }

  const match =
    refunds.find((refund) => refund.originIntentId === intent.intentId) ??
    refunds.find(
      (refund) =>
        !refund.originIntentId &&
        refund.amountMinor === intent.amountMinor &&
        Boolean(refund.createdAt && refund.createdAt.getTime() >= intent.createdAt.getTime() - 60_000),
    );
  if (match) {
    await clearRefundIntent(db, razorpayPaymentId, intent.intentId);
    metric("origin.payments.refund.intent_resolved", { outcome: "refund_found" });
    return { outcome: "refund_found", intent, refundId: match.id, checked: refunds.length };
  }
  if (!intent.pastSettle) {
    metric("origin.payments.refund.intent_settling");
    return {
      outcome: "settling",
      intent,
      settlesAt: new Date(intent.createdAt.getTime() + REFUND_INTENT_SETTLE_MS).toISOString(),
      checked: refunds.length,
    };
  }
  return { outcome: "no_refund", intent, checked: refunds.length };
}

function refusalForEarlierIntent(check: Exclude<RefundIntentCheck, { outcome: "none" } | { outcome: "no_refund" }>) {
  if (check.outcome === "refund_found") {
    return new PaymentLifecycleError(
      409,
      `The earlier refund attempt for this payment did reach Razorpay (${check.refundId}) and is now recorded. ` +
        "Check the refunds list before sending another.",
    );
  }
  if (check.outcome === "settling") {
    return new PaymentLifecycleError(
      409,
      "The outcome of an earlier refund attempt for this payment is still being confirmed with Razorpay. " +
        "Try again in a few minutes; no new refund was sent.",
    );
  }
  return new PaymentLifecycleError(
    409,
    check.reason === "record_failed"
      ? `An earlier refund attempt for this payment has an unknown outcome, and Razorpay refund ${check.refundId} ` +
          "could not be recorded while checking it. No new refund was sent."
      : "An earlier refund attempt for this payment has an unknown outcome and Razorpay could not be checked just now. " +
          "Try again in a minute; no new refund was sent.",
  );
}

export type RefundIntentSettleResult = {
  inspected: number;
  refundFound: number;
  dropped: number;
  settling: number;
  unresolved: number;
};

/**
 * Reconcile backstop: re-checks every open unknown intent (and every `sending`
 * one past the TTL) against Razorpay, so a stuck intent settles even if no
 * admin retries. Found refunds are recorded; an intent past the settle window
 * with no refund is dropped; the rest are left for the next pass.
 */
export async function settleRefundIntents(input: {
  limit: number;
  razorpayClient?: RazorpayRefundAdapter;
  db?: RefundDb;
}): Promise<RefundIntentSettleResult> {
  const result: RefundIntentSettleResult = { inspected: 0, refundFound: 0, dropped: 0, settling: 0, unresolved: 0 };
  const db: RefundDb = input.db ?? pool();
  const gateway = () => input.razorpayClient ?? (getRazorpayClient() as unknown as RazorpayRefundAdapter);
  let paymentIds: string[];
  {
    const client = await db.connect();
    try {
      const rows = await client.query(
        `SELECT razorpay_payment_id FROM payments.refund_intents
          WHERE abandoned_at IS NULL
            AND (state = 'unknown' OR created_at <= NOW() - make_interval(secs => $1))
          ORDER BY created_at ASC
          LIMIT $2`,
        [REFUND_INTENT_TTL_MS / 1000, Math.min(Math.max(Math.trunc(input.limit), 1), 200)],
      );
      paymentIds = rows.rows.map((row) => String(row.razorpay_payment_id));
    } finally {
      client.release();
    }
  }
  for (const paymentId of paymentIds) {
    const check = await checkRefundIntent(db, paymentId, gateway);
    if (check.outcome === "none") continue;
    result.inspected += 1;
    if (check.outcome === "refund_found") result.refundFound += 1;
    else if (check.outcome === "settling") result.settling += 1;
    else if (check.outcome === "unresolved") result.unresolved += 1;
    else {
      await clearRefundIntent(db, paymentId, check.intent.intentId);
      metric("origin.payments.refund.intent_resolved", { outcome: "no_refund" });
      result.dropped += 1;
    }
  }
  return result;
}

export type RefundIntentView = {
  razorpayPaymentId: string;
  intentId: string;
  amountMinor: number;
  initiatedBy: string | null;
  /** `sending` (in flight), `unknown` (ambiguous answer), or `abandoned` by an admin. */
  state: "sending" | "unknown" | "abandoned";
  createdAt: string;
  /** When "no refund" may be concluded for it (see REFUND_INTENT_SETTLE_MS). */
  settlesAt: string;
  abandonedAt: string | null;
  abandonedBy: string | null;
};

/** Admin view: open and abandoned refund intents, newest first. */
export async function listRefundIntents(input: { limit?: number; db?: RefundDb } = {}): Promise<RefundIntentView[]> {
  await ensurePaymentsAndGrantSchema();
  const db: RefundDb = input.db ?? pool();
  const client = await db.connect();
  try {
    const rows = await client.query(
      `SELECT razorpay_payment_id, intent_id, amount_minor, initiated_by, state, created_at, abandoned_at, abandoned_by
         FROM payments.refund_intents
        ORDER BY created_at DESC
        LIMIT $1`,
      [Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 500)],
    );
    return rows.rows.map((row) => {
      const createdAt = new Date(row.created_at);
      return {
        razorpayPaymentId: String(row.razorpay_payment_id),
        intentId: String(row.intent_id),
        amountMinor: Number(row.amount_minor),
        initiatedBy: text(row.initiated_by),
        state: row.abandoned_at ? "abandoned" : row.state === "unknown" ? "unknown" : "sending",
        createdAt: createdAt.toISOString(),
        settlesAt: new Date(createdAt.getTime() + REFUND_INTENT_SETTLE_MS).toISOString(),
        abandonedAt: row.abandoned_at ? new Date(row.abandoned_at).toISOString() : null,
        abandonedBy: text(row.abandoned_by),
      };
    });
  } finally {
    client.release();
  }
}

export type AbandonRefundIntentResult =
  | { outcome: "refund_found"; intentId: string; razorpayRefundId: string }
  | { outcome: "abandoned"; intentId: string; amountMinor: number; abandonedAt: string };

/**
 * Admin escape for a stuck intent. Re-runs the Razorpay lookup first: a
 * refund that did go out is recorded (and the intent cleared) instead. Only
 * when Razorpay still lists no refund for the intent AND the settle window has
 * passed is the intent marked abandoned (kept for the record, no longer
 * blocking). The audit event is written with the transaction's own client
 * (`audit(event, { client })`), so the abandonment and its audit row commit or
 * roll back together: neither exists without the other.
 */
export async function abandonRefundIntent(input: {
  razorpayPaymentId: string;
  actorUserId: string;
  requestId?: string | null;
  /** Must write through `tx.client` (e.g. `recordAuditEvent`), inside the abandon transaction. */
  audit: (event: AuditEventInput, tx: { client: PoolClient }) => Promise<void>;
  razorpayClient?: RazorpayRefundAdapter;
  db?: RefundDb;
}): Promise<AbandonRefundIntentResult> {
  await ensurePaymentsAndGrantSchema();
  const db: RefundDb = input.db ?? pool();
  const gateway = () => input.razorpayClient ?? (getRazorpayClient() as unknown as RazorpayRefundAdapter);
  const check = await checkRefundIntent(db, input.razorpayPaymentId, gateway);
  switch (check.outcome) {
    case "none":
      throw new PaymentLifecycleError(404, "There is no unresolved refund attempt for this payment.");
    case "refund_found":
      return { outcome: "refund_found", intentId: check.intent.intentId, razorpayRefundId: check.refundId };
    case "settling":
      throw new PaymentLifecycleError(
        409,
        `Razorpay lists no refund for this attempt yet, but it may still be settling. Try again after ${check.settlesAt}.`,
      );
    case "unresolved":
      throw new PaymentLifecycleError(
        409,
        check.reason === "record_failed"
          ? `Razorpay lists refund ${check.refundId} for this payment but it could not be recorded in the ledger. ` +
              "Resolve that before abandoning the attempt."
          : "Razorpay could not be checked just now, so the attempt cannot be abandoned yet. Try again in a minute.",
      );
    case "no_refund":
      break;
  }

  const { intent } = check;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE payments.refund_intents SET abandoned_at = NOW(), abandoned_by = $3
        WHERE razorpay_payment_id = $1 AND intent_id = $2 AND abandoned_at IS NULL
        RETURNING abandoned_at`,
      [input.razorpayPaymentId, intent.intentId, input.actorUserId],
    );
    if (!updated.rows[0]) {
      throw new PaymentLifecycleError(409, "The refund attempt changed while it was being checked. Reload and try again.");
    }
    const abandonedAt = new Date(updated.rows[0].abandoned_at).toISOString();
    await input.audit({
      actorUserId: input.actorUserId,
      workspaceId: null,
      entityType: "payment",
      entityId: input.razorpayPaymentId,
      action: "payment.refund_intent_abandoned",
      before: {
        intentId: intent.intentId,
        amountMinor: intent.amountMinor,
        state: intent.state,
        initiatedBy: intent.initiatedBy,
        createdAt: intent.createdAt.toISOString(),
      },
      after: { state: "abandoned", abandonedAt, razorpayRefundsChecked: check.checked },
      requestId: input.requestId ?? null,
    }, { client });
    await client.query("COMMIT");
    metric("origin.payments.refund.intent_abandoned");
    return { outcome: "abandoned", intentId: intent.intentId, amountMinor: intent.amountMinor, abandonedAt };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Best-effort: drops OUR intent only (a newer initiation's intent is left alone). */
async function clearRefundIntent(db: RefundDb, razorpayPaymentId: string, intentId: string): Promise<void> {
  const client = await db.connect().catch(() => null);
  if (!client) return;
  try {
    await client.query(`DELETE FROM payments.refund_intents WHERE razorpay_payment_id = $1 AND intent_id = $2`, [
      razorpayPaymentId,
      intentId,
    ]);
  } catch (error) {
    console.error("[refunds] could not clear refund intent; it expires on its own", error);
  } finally {
    client.release();
  }
}

export type DisputeLifecycleResult = {
  disputeId: string;
  razorpayPaymentId: string;
  userId: string | null;
  accessRevoked: false;
  alreadyApplied: boolean;
};

/** Flags a payment and alerts admins. Entitlement is deliberately untouched. */
export async function applyDisputeCreated(input: {
  disputeId: string;
  razorpayPaymentId: string;
  status?: string | null;
  raw?: Record<string, unknown>;
  createdAt?: Date | null;
}): Promise<DisputeLifecycleResult> {
  await ensurePaymentsAndGrantSchema();
  const client = await pool().connect();
  let outboxIds: string[] = [];
  let userId: string | null = null;
  let alreadyApplied = false;
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT user_id, dispute_id FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
      [input.razorpayPaymentId],
    );
    if (!locked.rows[0]) throw new PaymentLifecycleError(404, "Dispute refers to an unknown payment.");
    userId = text(locked.rows[0].user_id);
    alreadyApplied = text(locked.rows[0].dispute_id) === input.disputeId;
    await markPaymentDisputed({
      razorpayPaymentId: input.razorpayPaymentId,
      disputeId: input.disputeId,
      status: input.status ?? "created",
      raw: input.raw,
      disputedAt: input.createdAt ?? new Date(),
      exec: client,
    });
    outboxIds = await enqueueAdminAlerts(client, {
      idPrefix: `payment_dispute_${input.disputeId}`,
      title: "Payment dispute opened",
      message: `${input.razorpayPaymentId} has a Razorpay dispute. Access was retained for manual review.`,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await Promise.all(outboxIds.map((id) => publishOutbox(id).catch(() => undefined)));
  metric("origin.payments.dispute.created", { source: alreadyApplied ? "duplicate" : "new" });
  return {
    disputeId: input.disputeId,
    razorpayPaymentId: input.razorpayPaymentId,
    userId,
    accessRevoked: false,
    alreadyApplied,
  };
}

/**
 * Parses Razorpay refund payloads for the unified webhook adapter. The status
 * comes from the refund entity; when absent it is derived from the event name
 * (`refund.processed` → processed, `refund.failed` → failed) and otherwise
 * stays `pending` — it never defaults to processed.
 */
export function refundInputFromEvent(
  body: Record<string, unknown>,
  eventName?: string | null,
): RefundLifecycleInput {
  const payload = (body.payload as Record<string, unknown> | undefined) ?? body;
  const wrapper = (payload.refund as Record<string, unknown> | undefined) ?? {};
  const refund = (wrapper.entity as Record<string, unknown> | undefined) ?? wrapper;
  const razorpayRefundId = text(refund.id);
  const razorpayPaymentId = text(refund.payment_id);
  const amountMinor = integer(refund.amount);
  if (!razorpayRefundId || !razorpayPaymentId || amountMinor == null) {
    throw new PaymentLifecycleError(400, "Refund event is missing its id, payment id, or amount.");
  }
  const notes = refund.notes && typeof refund.notes === "object"
    ? (refund.notes as Record<string, unknown>)
    : {};
  return {
    razorpayRefundId,
    razorpayPaymentId,
    amountMinor,
    status: refundStatusFromEvent(text(refund.status), eventName ?? text(body.event)),
    reason: text(notes.origin_reason) ?? text(refund.reason),
    raw: body,
    createdAt: epochDate(refund.created_at),
  };
}

function refundStatusFromEvent(entityStatus: string | null, eventName: string | null): string {
  // The event name is authoritative for the terminal events: Razorpay sends
  // `refund.failed` with status `failed`, but a body missing the field must
  // still never be read as a successful refund.
  if (eventName === "refund.failed") return "failed";
  if (entityStatus) return entityStatus;
  if (eventName === "refund.processed") return "processed";
  return "pending";
}

/** Parses Razorpay dispute payloads for the unified webhook adapter. */
export function disputeInputFromEvent(body: Record<string, unknown>) {
  const payload = (body.payload as Record<string, unknown> | undefined) ?? body;
  const wrapper = (payload.dispute as Record<string, unknown> | undefined) ?? {};
  const dispute = (wrapper.entity as Record<string, unknown> | undefined) ?? wrapper;
  const paymentWrapper = (payload.payment as Record<string, unknown> | undefined) ?? {};
  const payment = (paymentWrapper.entity as Record<string, unknown> | undefined) ?? paymentWrapper;
  const disputeId = text(dispute.id);
  const razorpayPaymentId = text(dispute.payment_id) ?? text(payment.id);
  if (!disputeId || !razorpayPaymentId) {
    throw new PaymentLifecycleError(400, "Dispute event is missing its id or payment id.");
  }
  return {
    disputeId,
    razorpayPaymentId,
    status: text(dispute.status) ?? "created",
    raw: body,
    createdAt: epochDate(dispute.created_at),
  };
}
