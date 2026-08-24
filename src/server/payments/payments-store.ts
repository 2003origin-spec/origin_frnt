/**
 * Typed data access for the `payments` money ledger.
 * Aligned to src/db/migrations/20260822_payments_core.sql.
 *
 * Every function here is a thin, idempotent primitive. Business rules — amount
 * resolution, entitlement granting, coupon lifecycle — live in the services
 * above this layer, never here.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §5.1 (Phase 1).
 */

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import { ensurePaymentsSchema } from "./payments-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderKind =
  | "subject_term"
  | "bundle_term"
  | "institute_offering"
  | "subject_subscription"
  | "batch_subscription";

export type OrderStatus =
  | "created"
  | "attempted"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded";

export type EventStatus = "pending" | "processed" | "failed" | "ignored" | "orphaned";
export type OutboxStatus = "pending" | "processing" | "done" | "failed";

export type PaymentOrder = {
  id: string;
  userId: string;
  kind: OrderKind;
  subject: string | null;
  bundleId: string | null;
  workspaceId: string | null;
  offeringId: string | null;
  termMonths: number;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  couponCode: string | null;
  razorpayOrderId: string | null;
  status: OrderStatus;
  livemode: boolean;
  idempotencyKey: string | null;
  failureReason: string | null;
  notes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
};

export type PaymentRecord = {
  razorpayPaymentId: string;
  orderId: string | null;
  subscriptionId: string | null;
  razorpayInvoiceId: string | null;
  userId: string | null;
  amountMinor: number;
  amountRefundedMinor: number;
  currency: string;
  method: string | null;
  status: string;
  feeMinor: number | null;
  taxMinor: number | null;
  livemode: boolean;
  capturedAt: string | null;
  disputeId: string | null;
  disputedAt: string | null;
  disputeStatus: string | null;
  createdAt: string;
};

export type PaymentEvent = {
  eventId: string;
  eventType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  status: EventStatus;
  attempts: number;
  error: string | null;
  livemode: boolean;
  receivedAt: string;
  processedAt: string | null;
  nextAttemptAt: string;
};

export type OutboxRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  error: string | null;
  dispatchedVia: string | null;
  createdAt: string;
  nextAttemptAt: string;
  doneAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Every query runs through the same executor so a caller can pass a txn client. */
type Executor = Pick<Pool | PoolClient, "query">;

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function isoRequired(value: unknown): string {
  return iso(value) ?? new Date(0).toISOString();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function newOrderId(): string {
  return createPrefixedId("ord");
}

export function newOutboxId(): string {
  return createPrefixedId("obx");
}

function rowToOrder(row: Record<string, unknown>): PaymentOrder {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    kind: row.kind as OrderKind,
    subject: (row.subject as string | null) ?? null,
    bundleId: (row.bundle_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    offeringId: (row.offering_id as string | null) ?? null,
    termMonths: num(row.term_months) || 1,
    baseAmountMinor: num(row.base_amount_minor),
    discountMinor: num(row.discount_minor),
    amountMinor: num(row.amount_minor),
    currency: (row.currency as string) ?? "INR",
    couponCode: (row.coupon_code as string | null) ?? null,
    razorpayOrderId: (row.razorpay_order_id as string | null) ?? null,
    status: row.status as OrderStatus,
    livemode: Boolean(row.livemode),
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    notes: jsonObject(row.notes),
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
    paidAt: iso(row.paid_at),
    expiresAt: iso(row.expires_at),
  };
}

function rowToPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    razorpayPaymentId: row.razorpay_payment_id as string,
    orderId: (row.order_id as string | null) ?? null,
    subscriptionId: (row.subscription_id as string | null) ?? null,
    razorpayInvoiceId: (row.razorpay_invoice_id as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    amountMinor: num(row.amount_minor),
    amountRefundedMinor: num(row.amount_refunded_minor),
    currency: (row.currency as string) ?? "INR",
    method: (row.method as string | null) ?? null,
    status: row.status as string,
    feeMinor: row.fee_minor == null ? null : num(row.fee_minor),
    taxMinor: row.tax_minor == null ? null : num(row.tax_minor),
    livemode: Boolean(row.livemode),
    capturedAt: iso(row.captured_at),
    disputeId: (row.dispute_id as string | null) ?? null,
    disputedAt: iso(row.disputed_at),
    disputeStatus: (row.dispute_status as string | null) ?? null,
    createdAt: isoRequired(row.created_at),
  };
}

function rowToEvent(row: Record<string, unknown>): PaymentEvent {
  return {
    eventId: row.event_id as string,
    eventType: (row.event_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    payload: jsonObject(row.payload),
    status: row.status as EventStatus,
    attempts: num(row.attempts),
    error: (row.error as string | null) ?? null,
    livemode: Boolean(row.livemode),
    receivedAt: isoRequired(row.received_at),
    processedAt: iso(row.processed_at),
    nextAttemptAt: isoRequired(row.next_attempt_at),
  };
}

function rowToOutbox(row: Record<string, unknown>): OutboxRow {
  return {
    id: row.id as string,
    kind: row.kind as string,
    payload: jsonObject(row.payload),
    status: row.status as OutboxStatus,
    attempts: num(row.attempts),
    error: (row.error as string | null) ?? null,
    dispatchedVia: (row.dispatched_via as string | null) ?? null,
    createdAt: isoRequired(row.created_at),
    nextAttemptAt: isoRequired(row.next_attempt_at),
    doneAt: iso(row.done_at),
  };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type InsertOrderInput = {
  id: string;
  userId: string;
  kind: OrderKind;
  subject?: string | null;
  bundleId?: string | null;
  workspaceId?: string | null;
  offeringId?: string | null;
  termMonths: number;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency?: string;
  couponCode?: string | null;
  livemode: boolean;
  idempotencyKey?: string | null;
  notes?: Record<string, unknown>;
  /** Abandoned-checkout sweep horizon. */
  expiresAt?: Date | null;
};

/**
 * Writes the order row BEFORE Razorpay is called, so a Razorpay failure can never
 * leave us with a charge we have no record of. `razorpay_order_id` is attached
 * afterwards by `attachRazorpayOrderId`.
 */
export async function insertOrder(input: InsertOrderInput, exec?: Executor): Promise<PaymentOrder> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `INSERT INTO payments.orders
       (id, user_id, kind, subject, bundle_id, workspace_id, offering_id, term_months,
        base_amount_minor, discount_minor, amount_minor, currency, coupon_code,
        status, livemode, idempotency_key, notes, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'created',$14,$15,$16::jsonb,$17)
     RETURNING *`,
    [
      input.id,
      input.userId,
      input.kind,
      input.subject ?? null,
      input.bundleId ?? null,
      input.workspaceId ?? null,
      input.offeringId ?? null,
      input.termMonths,
      input.baseAmountMinor,
      input.discountMinor,
      input.amountMinor,
      input.currency ?? "INR",
      input.couponCode ?? null,
      input.livemode,
      input.idempotencyKey ?? null,
      JSON.stringify(input.notes ?? {}),
      input.expiresAt ?? null,
    ],
  );
  return rowToOrder(res.rows[0]);
}

/** Attaches the Razorpay order id and moves the row to `attempted`. */
export async function attachRazorpayOrderId(
  orderId: string,
  razorpayOrderId: string,
  exec?: Executor,
): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `UPDATE payments.orders
        SET razorpay_order_id = $2, status = 'attempted', updated_at = NOW()
      WHERE id = $1 AND status = 'created'
      RETURNING *`,
    [orderId, razorpayOrderId],
  );
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}

export async function getOrderById(orderId: string, exec?: Executor): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(`SELECT * FROM payments.orders WHERE id = $1`, [orderId]);
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}

export async function getOrderByRazorpayId(
  razorpayOrderId: string,
  exec?: Executor,
): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(`SELECT * FROM payments.orders WHERE razorpay_order_id = $1`, [
    razorpayOrderId,
  ]);
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}

export async function getOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  exec?: Executor,
): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `SELECT * FROM payments.orders WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, idempotencyKey],
  );
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}

/**
 * Terminal-state transition. `paid` also stamps `paid_at`.
 *
 * GUARDED so a late/duplicate event can never walk a `paid` order backwards into
 * `failed` or `expired`: once money has landed, only a refund transition moves it.
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  opts?: {
    failureReason?: string | null;
    clearIdempotencyKey?: boolean;
    /**
     * The instant money actually landed. Supplied by `applyPaymentSuccess` so
     * `paid_at` is the capture time rather than the moment this UPDATE ran.
     * Without it a reconciled or replayed capture stamps NOW(), which makes an
     * older purchase look newer than one settled after it and inverts the
     * grant-stacking order. NULL keeps the historical NOW() behaviour.
     */
    paidAt?: Date | string | null;
  },
  exec?: Executor,
): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  // $2 is bound as text and cast explicitly: it is used BOTH as the enum column
  // value and in text comparisons below, which otherwise leaves its type
  // ambiguous to the planner.
  const res = await db.query(
    `UPDATE payments.orders
        SET status         = $2::payments.order_status,
            failure_reason = COALESCE($3, failure_reason),
            idempotency_key = CASE WHEN $4::boolean THEN NULL ELSE idempotency_key END,
            paid_at        = CASE WHEN $2 = 'paid'
                               THEN COALESCE(paid_at, $5::timestamptz, NOW())
                               ELSE paid_at END,
            updated_at     = NOW()
      WHERE id = $1
        AND (
          -- Money never un-lands, and a refund never un-refunds. Once an order
          -- reaches a terminal money state the only onward moves are refund
          -- states; a refunded order can NEVER return to 'paid'. Without the
          -- second clause, two different webhooks for one payment (order.paid
          -- arriving after payment.captured already drove a refund) would
          -- resurrect a refunded order and re-grant entitlement.
          status NOT IN ('paid', 'refunded', 'partially_refunded')
          OR (status = 'paid' AND $2 IN ('paid', 'refunded', 'partially_refunded'))
          OR (status IN ('refunded', 'partially_refunded')
              AND $2 IN ('refunded', 'partially_refunded'))
        )
      RETURNING *`,
    [
      orderId,
      status,
      opts?.failureReason ?? null,
      opts?.clearIdempotencyKey === true,
      opts?.paidAt ?? null,
    ],
  );
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}

export async function listUserOrders(userId: string, limit = 50): Promise<PaymentOrder[]> {
  await ensurePaymentsSchema();
  const res = await pool().query(
    `SELECT * FROM payments.orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 200)],
  );
  return res.rows.map(rowToOrder);
}

/** Bounded Rail-A candidates for the resumable reconciliation pass. */
export async function listReconciliationOrders(input: {
  olderThan: Date;
  limit?: number;
}): Promise<PaymentOrder[]> {
  await ensurePaymentsSchema();
  const result = await pool().query(
    `SELECT * FROM payments.orders
      WHERE status IN ('created', 'attempted')
        AND created_at < $1
      ORDER BY created_at ASC, id ASC
      LIMIT $2`,
    [input.olderThan, Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 200)],
  );
  return result.rows.map(rowToOrder);
}

/** Open local orders owned by a user, used by account deletion. */
export async function listOpenOrdersForUser(userId: string, exec?: Executor): Promise<PaymentOrder[]> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const result = await db.query(
    `SELECT * FROM payments.orders
      WHERE user_id = $1 AND status IN ('created', 'attempted')
      ORDER BY created_at ASC, id ASC`,
    [userId],
  );
  return result.rows.map(rowToOrder);
}

/** Marks one unpaid order expired. The caller handles coupon release in its transaction. */
export async function expireOrder(
  orderId: string,
  reason = "checkout_expired",
  exec?: Executor,
): Promise<PaymentOrder | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const result = await db.query(
    `UPDATE payments.orders
        SET status = 'expired', failure_reason = COALESCE(failure_reason, $2),
            idempotency_key = NULL, updated_at = NOW()
      WHERE id = $1 AND status IN ('created', 'attempted')
      RETURNING *`,
    [orderId, reason],
  );
  return result.rows[0] ? rowToOrder(result.rows[0]) : null;
}

// ─── Payments (individual charges) ────────────────────────────────────────────

export type UpsertPaymentInput = {
  razorpayPaymentId: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  razorpayInvoiceId?: string | null;
  userId?: string | null;
  amountMinor: number;
  currency?: string;
  method?: string | null;
  status: string;
  feeMinor?: number | null;
  taxMinor?: number | null;
  livemode: boolean;
  capturedAt?: Date | null;
  disputeId?: string | null;
  disputedAt?: Date | null;
  disputeStatus?: string | null;
  disputeRaw?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
};

/** Idempotent on razorpay_payment_id — the webhook and the client fast path
 *  both land here and must converge on one row. */
export async function upsertPayment(
  input: UpsertPaymentInput,
  exec?: Executor,
): Promise<PaymentRecord> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `INSERT INTO payments.payments
       (razorpay_payment_id, order_id, subscription_id, razorpay_invoice_id, user_id,
        amount_minor, currency, method, status, fee_minor, tax_minor, livemode, captured_at, raw,
        dispute_id, disputed_at, dispute_status, dispute_raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18::jsonb)
     ON CONFLICT (razorpay_payment_id) DO UPDATE SET
       order_id            = COALESCE(EXCLUDED.order_id, payments.payments.order_id),
       subscription_id     = COALESCE(EXCLUDED.subscription_id, payments.payments.subscription_id),
       razorpay_invoice_id = COALESCE(EXCLUDED.razorpay_invoice_id, payments.payments.razorpay_invoice_id),
       user_id             = COALESCE(EXCLUDED.user_id, payments.payments.user_id),
       amount_minor        = EXCLUDED.amount_minor,
       method              = COALESCE(EXCLUDED.method, payments.payments.method),
       status              = EXCLUDED.status,
       fee_minor           = COALESCE(EXCLUDED.fee_minor, payments.payments.fee_minor),
       tax_minor           = COALESCE(EXCLUDED.tax_minor, payments.payments.tax_minor),
       captured_at         = COALESCE(EXCLUDED.captured_at, payments.payments.captured_at),
       raw                 = EXCLUDED.raw,
       dispute_id          = COALESCE(EXCLUDED.dispute_id, payments.payments.dispute_id),
       disputed_at         = COALESCE(EXCLUDED.disputed_at, payments.payments.disputed_at),
       dispute_status      = COALESCE(EXCLUDED.dispute_status, payments.payments.dispute_status),
       dispute_raw         = COALESCE(EXCLUDED.dispute_raw, payments.payments.dispute_raw)
     RETURNING *`,
    [
      input.razorpayPaymentId,
      input.orderId ?? null,
      input.subscriptionId ?? null,
      input.razorpayInvoiceId ?? null,
      input.userId ?? null,
      input.amountMinor,
      input.currency ?? "INR",
      input.method ?? null,
      input.status,
      input.feeMinor ?? null,
      input.taxMinor ?? null,
      input.livemode,
      input.capturedAt ?? null,
      JSON.stringify(input.raw ?? {}),
      input.disputeId ?? null,
      input.disputedAt ?? null,
      input.disputeStatus ?? null,
      input.disputeRaw == null ? null : JSON.stringify(input.disputeRaw),
    ],
  );
  return rowToPayment(res.rows[0]);
}

export async function getPaymentById(
  razorpayPaymentId: string,
  exec?: Executor,
): Promise<PaymentRecord | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(`SELECT * FROM payments.payments WHERE razorpay_payment_id = $1`, [
    razorpayPaymentId,
  ]);
  return res.rows[0] ? rowToPayment(res.rows[0]) : null;
}

export async function listRefundsForPayment(
  razorpayPaymentId: string,
  exec?: Executor,
): Promise<Array<{
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountMinor: number;
  isFull: boolean;
  status: string;
  reason: string | null;
  initiatedBy: string | null;
  livemode: boolean;
  raw: Record<string, unknown>;
  createdAt: string;
}>> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `SELECT * FROM payments.refunds WHERE razorpay_payment_id = $1 ORDER BY created_at ASC, razorpay_refund_id ASC`,
    [razorpayPaymentId],
  );
  return res.rows.map((row) => ({
    razorpayRefundId: String(row.razorpay_refund_id),
    razorpayPaymentId: String(row.razorpay_payment_id),
    amountMinor: num(row.amount_minor),
    isFull: Boolean(row.is_full),
    status: String(row.status),
    reason: (row.reason as string | null) ?? null,
    initiatedBy: (row.initiated_by as string | null) ?? null,
    livemode: Boolean(row.livemode),
    raw: jsonObject(row.raw),
    createdAt: isoRequired(row.created_at),
  }));
}

/** Marks a captured payment as disputed without changing entitlement. */
export async function markPaymentDisputed(input: {
  razorpayPaymentId: string;
  disputeId?: string | null;
  status?: string | null;
  raw?: Record<string, unknown>;
  disputedAt?: Date | null;
  exec?: Executor;
}): Promise<boolean> {
  if (!input.exec) await ensurePaymentsSchema();
  const db = input.exec ?? pool();
  const result = await db.query(
    `UPDATE payments.payments
        SET dispute_id = COALESCE($2, dispute_id),
            disputed_at = COALESCE($3, disputed_at, NOW()),
            dispute_status = COALESCE($4, dispute_status),
            dispute_raw = COALESCE($5::jsonb, dispute_raw)
      WHERE razorpay_payment_id = $1
      RETURNING razorpay_payment_id`,
    [
      input.razorpayPaymentId,
      input.disputeId ?? null,
      input.disputedAt ?? null,
      input.status ?? "created",
      input.raw == null ? null : JSON.stringify(input.raw),
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export type InsertRefundInput = {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountMinor: number;
  isFull: boolean;
  status: string;
  reason?: string | null;
  initiatedBy?: string | null;
  livemode: boolean;
  raw?: Record<string, unknown>;
};

/**
 * Records a refund and rolls the running refunded total onto the payment.
 * Idempotent on razorpay_refund_id; the total is only bumped for a NEW refund,
 * so a duplicate webhook cannot double-count.
 */
export async function insertRefund(
  input: InsertRefundInput,
  exec?: Executor,
): Promise<{ inserted: boolean }> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `INSERT INTO payments.refunds
       (razorpay_refund_id, razorpay_payment_id, amount_minor, is_full, status, reason, initiated_by, livemode, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (razorpay_refund_id) DO UPDATE SET
       status       = EXCLUDED.status,
       is_full      = payments.refunds.is_full OR EXCLUDED.is_full,
       reason       = COALESCE(payments.refunds.reason, EXCLUDED.reason),
       initiated_by = COALESCE(payments.refunds.initiated_by, EXCLUDED.initiated_by),
       raw          = EXCLUDED.raw
     RETURNING (xmax = 0) AS inserted`,
    [
      input.razorpayRefundId,
      input.razorpayPaymentId,
      input.amountMinor,
      input.isFull,
      input.status,
      input.reason ?? null,
      input.initiatedBy ?? null,
      input.livemode,
      JSON.stringify(input.raw ?? {}),
    ],
  );
  const inserted = Boolean(res.rows[0]?.inserted);
  if (inserted) {
    await db.query(
      `UPDATE payments.payments
          SET amount_refunded_minor = LEAST(
                amount_minor,
                COALESCE((
                  SELECT SUM(amount_minor) FROM payments.refunds
                   WHERE razorpay_payment_id = $1
                ), 0)
              )
        WHERE razorpay_payment_id = $1`,
      [input.razorpayPaymentId],
    );
  }
  return { inserted };
}

// ─── Webhook event ledger ─────────────────────────────────────────────────────

/**
 * Idempotency ledger insert, retaining the RAW payload so any event can be
 * replayed after a processing bug. Returns `isNew: false` for a re-delivery.
 */
export async function recordEvent(
  input: {
    eventId: string;
    eventType: string | null;
    entityId: string | null;
    payload: Record<string, unknown>;
    livemode: boolean;
  },
  exec?: Executor,
): Promise<{ isNew: boolean }> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `INSERT INTO payments.events (event_id, event_type, entity_id, payload, livemode)
     VALUES ($1,$2,$3,$4::jsonb,$5)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [input.eventId, input.eventType, input.entityId, JSON.stringify(input.payload), input.livemode],
  );
  return { isNew: (res.rowCount ?? 0) > 0 };
}

export async function getEvent(eventId: string, exec?: Executor): Promise<PaymentEvent | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(`SELECT * FROM payments.events WHERE event_id = $1`, [eventId]);
  return res.rows[0] ? rowToEvent(res.rows[0]) : null;
}

/**
 * Records the OUTCOME of processing an event. Deliberately does NOT touch
 * `attempts` — the attempt is burned by `claimDueEvents` at claim time instead,
 * so a drain that dies mid-event (an OOM, a function timeout, a crash in the
 * handler) still counts against MAX_EVENT_ATTEMPTS. Counting on the outcome
 * would mean a process-killing event is never counted and retries forever.
 */
export async function setEventStatus(
  eventId: string,
  status: EventStatus,
  opts?: { error?: string | null; retryInSeconds?: number },
  exec?: Executor,
): Promise<void> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  await db.query(
    `UPDATE payments.events
        SET status          = $2,
            error           = $3,
            processed_at    = CASE WHEN $2 IN ('processed','ignored','orphaned') THEN NOW() ELSE processed_at END,
            next_attempt_at = NOW() + make_interval(secs => $4)
      WHERE event_id = $1`,
    [eventId, status, opts?.error ?? null, opts?.retryInSeconds ?? 0],
  );
}

/**
 * Max processing attempts for one webhook event. Higher than the outbox cap:
 * an event is money-bearing and its raw payload is retained, so it is worth
 * retrying hard before parking it for a human. Once exceeded the event stops
 * being claimed and shows up in the health backlog as `failedEvents`.
 */
export const MAX_EVENT_ATTEMPTS = 10;

/**
 * Claims due events for the drain. `FOR UPDATE SKIP LOCKED` plus a lease pushed
 * onto `next_attempt_at` makes concurrent drains (cron overlap, a QStash nudge
 * racing the cron) safe, and keeps the batch resumable if the function times out.
 *
 * A `failed` event is only re-claimed while it is under MAX_EVENT_ATTEMPTS — that
 * is what stops a permanently-poisoned event from being retried forever.
 *
 * `subscription.*` events are excluded on purpose (Phase 6). They are MIRRORED
 * into this table for replayability, but they are applied by the recurring rails
 * — whose retry authority is Razorpay's own redelivery, not this drain. Without
 * this filter the drain would claim a subscription event it has no handler for,
 * burn its attempts and mark it `ignored`, destroying the failure record a human
 * needs to see in the backlog.
 */
export async function claimDueEvents(limit: number): Promise<PaymentEvent[]> {
  await ensurePaymentsSchema();
  const res = await pool().query(
    `WITH due AS (
       SELECT event_id FROM payments.events
        WHERE next_attempt_at <= NOW()
          AND (status = 'pending' OR (status = 'failed' AND attempts < $2))
          AND (event_type IS NULL OR event_type NOT LIKE 'subscription.%')
        ORDER BY received_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE payments.events e
        SET next_attempt_at = NOW() + INTERVAL '5 minutes',
            attempts        = e.attempts + 1
       FROM due
      WHERE e.event_id = due.event_id
      RETURNING e.*`,
    [Math.min(Math.max(limit, 1), 100), MAX_EVENT_ATTEMPTS],
  );
  return res.rows.map(rowToEvent);
}

// ─── Transactional outbox ─────────────────────────────────────────────────────

/**
 * Enqueues a side effect. Call this INSIDE the same transaction that grants
 * entitlement — that is what makes "paid ⇒ receipt eventually sent" a guarantee
 * rather than a hope.
 */
export async function enqueueOutbox(
  input: { id?: string; kind: string; payload: Record<string, unknown> },
  exec?: Executor,
): Promise<string> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const id = input.id ?? newOutboxId();
  await db.query(
    `INSERT INTO payments.outbox (id, kind, payload) VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, input.kind, JSON.stringify(input.payload)],
  );
  return id;
}

export async function getOutboxRow(id: string, exec?: Executor): Promise<OutboxRow | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(`SELECT * FROM payments.outbox WHERE id = $1`, [id]);
  return res.rows[0] ? rowToOutbox(res.rows[0]) : null;
}

/**
 * Claims one outbox row for execution (the QStash single-row path).
 *
 * Returns null when the row is done, already being processed, or PARKED —
 * that is the guard which makes a duplicate QStash delivery a no-op rather than
 * a second email (plan E36). `status='failed'` is TERMINAL here: a parked row is
 * never picked up again by either claim path, only by an explicit admin requeue.
 *
 * Claiming also pushes a lease onto next_attempt_at, so a crash mid-dispatch is
 * recovered by `claimDueOutboxRows` instead of stranding the row in `processing`.
 */
export async function claimOutboxRow(id: string, exec?: Executor): Promise<OutboxRow | null> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  const res = await db.query(
    `UPDATE payments.outbox
        SET status = 'processing',
            attempts = attempts + 1,
            next_attempt_at = NOW() + make_interval(secs => $2)
      WHERE id = $1
        AND next_attempt_at <= NOW()
        AND (status = 'pending' OR (status = 'processing' AND next_attempt_at <= NOW()))
      RETURNING *`,
    [id, OUTBOX_LEASE_SECONDS],
  );
  return res.rows[0] ? rowToOutbox(res.rows[0]) : null;
}

/**
 * How long a claimed outbox row is considered in-flight. A row still `processing`
 * after this is treated as crashed and re-claimed, so a function that died
 * mid-send does not strand the receipt forever.
 */
export const OUTBOX_LEASE_SECONDS = 300;

/**
 * Claims a batch of due outbox rows for the cron drain.
 *
 * Picks up `pending` rows and STALE `processing` rows (crash recovery). Never
 * picks up `failed` — that state is terminal by design (plan E38), so a poisoned
 * row is parked for a human instead of being retried on every tick forever.
 */
export async function claimDueOutboxRows(limit: number): Promise<OutboxRow[]> {
  await ensurePaymentsSchema();
  const res = await pool().query(
    `WITH due AS (
       SELECT id FROM payments.outbox
        WHERE next_attempt_at <= NOW()
          AND status IN ('pending', 'processing')
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE payments.outbox o
        SET status = 'processing',
            attempts = o.attempts + 1,
            next_attempt_at = NOW() + make_interval(secs => $2)
       FROM due
      WHERE o.id = due.id
      RETURNING o.*`,
    [Math.min(Math.max(limit, 1), 100), OUTBOX_LEASE_SECONDS],
  );
  return res.rows.map(rowToOutbox);
}

export async function markOutboxDone(id: string, via: string, exec?: Executor): Promise<void> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  await db.query(
    `UPDATE payments.outbox
        SET status = 'done', done_at = NOW(), dispatched_via = $2, error = NULL
      WHERE id = $1`,
    [id, via],
  );
}

/**
 * Max attempts before a row is parked as permanently failed (plan E38).
 * `failed` is TERMINAL — neither claim path re-reads it.
 */
export const MAX_OUTBOX_ATTEMPTS = 6;

export async function markOutboxFailed(
  id: string,
  error: string,
  retryInSeconds: number,
  exec?: Executor,
): Promise<void> {
  if (!exec) await ensurePaymentsSchema();
  const db = exec ?? pool();
  await db.query(
    `UPDATE payments.outbox
        SET status          = CASE WHEN attempts >= $4 THEN 'failed' ELSE 'pending' END,
            error           = $2,
            next_attempt_at = NOW() + make_interval(secs => $3)
      WHERE id = $1`,
    [id, error.slice(0, 2000), retryInSeconds, MAX_OUTBOX_ATTEMPTS],
  );
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type PaymentsBacklog = {
  pendingEvents: number;
  failedEvents: number;
  pendingOutbox: number;
  failedOutbox: number;
  stuckOrders: number;
  lastWebhookAt: string | null;
  lastPaidAt: string | null;
};

/**
 * Backlog snapshot for /api/internal/payments/health and /admin/financials.
 * `stuckOrders` = created/attempted for over 15 minutes — the signal that
 * webhooks are not arriving at all.
 */
export async function getPaymentsBacklog(): Promise<PaymentsBacklog> {
  await ensurePaymentsSchema();
  const res = await pool().query(`
    SELECT
      (SELECT count(*) FROM payments.events WHERE status = 'pending')::int  AS pending_events,
      (SELECT count(*) FROM payments.events WHERE status = 'failed')::int   AS failed_events,
      (SELECT count(*) FROM payments.outbox WHERE status IN ('pending','processing'))::int AS pending_outbox,
      (SELECT count(*) FROM payments.outbox WHERE status = 'failed')::int   AS failed_outbox,
      (SELECT count(*) FROM payments.orders
        WHERE status IN ('created','attempted') AND created_at < NOW() - INTERVAL '15 minutes')::int AS stuck_orders,
      (SELECT max(received_at) FROM payments.events)                        AS last_webhook_at,
      (SELECT max(paid_at) FROM payments.orders)                            AS last_paid_at
  `);
  const row = res.rows[0] ?? {};
  return {
    pendingEvents: num(row.pending_events),
    failedEvents: num(row.failed_events),
    pendingOutbox: num(row.pending_outbox),
    failedOutbox: num(row.failed_outbox),
    stuckOrders: num(row.stuck_orders),
    lastWebhookAt: iso(row.last_webhook_at),
    lastPaidAt: iso(row.last_paid_at),
  };
}
