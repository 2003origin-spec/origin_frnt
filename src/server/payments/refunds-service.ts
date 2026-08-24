/** Refund and dispute lifecycle for the unified payments ledger (Phase 7). */

import type { PoolClient } from "pg";

import { metric } from "@/lib/metrics";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { getUserPostgresPool } from "@/server/user-postgres";

import { rebasePaidGrantExpiriesForSubject } from "./grants";
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

  const remainingMinor = Math.max(0, input.amountMinor - input.amountRefundedMinor);
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
  };
};

export type RefundLifecycleInput = {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountMinor: number;
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
};

type RefundTxnResult = RefundLifecycleResult & {
  recomputeUserId: string | null;
  outboxIds: string[];
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

async function enqueueAdminAlerts(
  client: PoolClient,
  input: { idPrefix: string; title: string; message: string; href?: string },
): Promise<string[]> {
  const admins = await client.query(`SELECT id FROM origin_users WHERE role = 'admin' ORDER BY id`);
  const ids: string[] = [];
  for (const row of admins.rows) {
    const adminId = String(row.id);
    const id = `${input.idPrefix}_${adminId}`;
    await enqueueOutbox(
      {
        id,
        kind: "notification",
        payload: {
          userId: adminId,
          notificationTitle: input.title,
          notificationMessage: input.message,
          href: input.href ?? "/admin/financials",
          type: "warning",
        },
      },
      client,
    );
    ids.push(id);
  }
  return ids;
}

async function applyRefundInTransaction(
  input: RefundLifecycleInput,
  client: PoolClient,
): Promise<RefundTxnResult> {
  if (!input.razorpayRefundId.trim()) throw new PaymentLifecycleError(400, "Refund id is required.");
  if (!input.razorpayPaymentId.trim()) throw new PaymentLifecycleError(400, "Payment id is required.");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new PaymentLifecycleError(400, "Refund amount must be a positive integer in paise.");
  }

  const paymentResult = await client.query(
    `SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
    [input.razorpayPaymentId],
  );
  const payment = paymentResult.rows[0] as Record<string, unknown> | undefined;
  if (!payment) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
  const paymentAmount = Number(payment.amount_minor) || 0;

  const existing = await client.query(
    `SELECT razorpay_payment_id FROM payments.refunds WHERE razorpay_refund_id = $1 FOR UPDATE`,
    [input.razorpayRefundId],
  );
  if (existing.rows[0] && String(existing.rows[0].razorpay_payment_id) !== input.razorpayPaymentId) {
    throw new PaymentLifecycleError(409, "Refund id is already linked to a different payment.");
  }
  if (!existing.rows[0]) {
    const currentRefunded = Number(payment.amount_refunded_minor) || 0;
    if (input.amountMinor > Math.max(0, paymentAmount - currentRefunded)) {
      throw new PaymentLifecycleError(409, "Refund amount exceeds the remaining refundable amount.");
    }
  }

  const write = await insertRefund(
    {
      razorpayRefundId: input.razorpayRefundId,
      razorpayPaymentId: input.razorpayPaymentId,
      amountMinor: input.amountMinor,
      isFull: false,
      status: input.status ?? "processed",
      reason: input.reason ?? null,
      initiatedBy: input.initiatedBy ?? null,
      livemode: Boolean(payment.livemode),
      raw: input.raw ?? {},
    },
    client,
  );

  const totalResult = await client.query(
    `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total
       FROM payments.refunds WHERE razorpay_payment_id = $1`,
    [input.razorpayPaymentId],
  );
  const amountRefundedMinor = Math.min(paymentAmount, Number(totalResult.rows[0]?.total) || 0);
  const isFull = amountRefundedMinor >= paymentAmount;
  await client.query(
    `UPDATE payments.refunds SET is_full = $2 WHERE razorpay_refund_id = $1`,
    [input.razorpayRefundId, isFull],
  );
  await client.query(
    `UPDATE payments.payments
        SET amount_refunded_minor = $2,
            status = CASE WHEN $3 THEN 'refunded' ELSE status END
      WHERE razorpay_payment_id = $1`,
    [input.razorpayPaymentId, amountRefundedMinor, isFull],
  );

  const orderId = text(payment.order_id);
  const userId = text(payment.user_id);
  let revokedGrantCount = 0;
  const outboxIds: string[] = [];
  if (orderId) {
    const orderStatus = isFull ? "refunded" : "partially_refunded";
    await setOrderStatus(orderId, orderStatus, undefined, client);
    if (isFull) {
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
          href: "/premium",
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

  return {
    razorpayRefundId: input.razorpayRefundId,
    razorpayPaymentId: input.razorpayPaymentId,
    orderId,
    userId,
    amountMinor: input.amountMinor,
    amountRefundedMinor,
    remainingMinor: Math.max(0, paymentAmount - amountRefundedMinor),
    isFull,
    orderStatus: orderId ? (isFull ? "refunded" : "partially_refunded") : null,
    alreadyApplied: !write.inserted,
    revokedGrantCount,
    recomputeUserId: isFull && orderId ? userId : null,
    outboxIds,
  };
}

async function runPostCommit(result: RefundTxnResult): Promise<void> {
  if (result.recomputeUserId) await recomputeUserPremiumFlags(result.recomputeUserId);
  await Promise.all(result.outboxIds.map((id) => publishOutbox(id).catch(() => undefined)));
  metric(result.isFull ? "origin.payments.refund.full" : "origin.payments.refund.partial", {
    source: result.alreadyApplied ? "duplicate" : "new",
  });
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
  };
}

/** Shared idempotent path for admin and refund webhook events. */
export async function applyRefundLifecycle(input: RefundLifecycleInput): Promise<RefundLifecycleResult> {
  await ensurePaymentsAndGrantSchema();
  const client = await pool().connect();
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

/** Admin initiation: validate under a row lock, call Razorpay, then apply locally. */
export async function initiateRefund(input: {
  razorpayPaymentId: string;
  amountMinor?: number | null;
  reason?: string | null;
  initiatedBy: string;
  now?: Date;
  razorpayClient?: RazorpayRefundAdapter;
}): Promise<RefundLifecycleResult & { windowEndsAt: string }> {
  await ensurePaymentsAndGrantSchema();
  const client = await pool().connect();
  let result: RefundTxnResult;
  let windowEndsAt = "";
  try {
    await client.query("BEGIN");
    const row = await client.query(
      `SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
      [input.razorpayPaymentId],
    );
    if (!row.rows[0]) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
    const payment = await getPaymentById(input.razorpayPaymentId, client);
    if (!payment) throw new PaymentLifecycleError(404, "Payment not found in the Origin ledger.");
    const validation = validateRefundRequest({
      ...payment,
      requestedAmountMinor: input.amountMinor,
      now: input.now,
    });
    windowEndsAt = validation.windowEndsAt;

    const gateway = input.razorpayClient ?? (getRazorpayClient() as unknown as RazorpayRefundAdapter);
    const external = await gateway.payments.refund(input.razorpayPaymentId, {
      amount: validation.amountMinor,
      speed: "normal",
      notes: {
        origin_initiated_by: input.initiatedBy,
        ...(input.reason ? { origin_reason: input.reason.slice(0, 200) } : {}),
      },
    });
    const refundId = text(external.id);
    if (!refundId) throw new PaymentLifecycleError(502, "Razorpay did not return a refund id.");
    const externalAmount = integer(external.amount) ?? validation.amountMinor;
    if (externalAmount <= 0 || externalAmount > validation.remainingMinor) {
      throw new PaymentLifecycleError(502, "Razorpay returned an invalid refund amount.");
    }
    result = await applyRefundInTransaction(
      {
        razorpayRefundId: refundId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountMinor: externalAmount,
        status: text(external.status) ?? "processed",
        reason: input.reason ?? null,
        initiatedBy: input.initiatedBy,
        raw: external,
        createdAt: epochDate(external.created_at),
      },
      client,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await runPostCommit(result);
  return { ...publicRefundResult(result), windowEndsAt };
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

/** Parses Razorpay refund payloads for the unified webhook adapter. */
export function refundInputFromEvent(body: Record<string, unknown>): RefundLifecycleInput {
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
    status: text(refund.status) ?? "processed",
    reason: text(notes.origin_reason) ?? text(refund.reason),
    raw: body,
    createdAt: epochDate(refund.created_at),
  };
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
