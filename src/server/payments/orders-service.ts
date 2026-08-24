/**
 * Rail A (prepaid, one-time Razorpay Orders) service.
 *
 * Routes should remain thin: they authenticate/validate the request and call
 * these functions. Amounts are resolved from the pricing tables here, the
 * local order is persisted before Razorpay is contacted, and every capture
 * converges through `applyPaymentSuccess`.
 */

import type { Pool } from "pg";

import { ALL_SUBJECTS, isSubject, type Subject } from "@/lib/entitlements";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getActiveBundle, getSubjectPriceResolved } from "@/server/pricing/pricing-service";
import {
  commitCouponReservation,
  releaseCouponReservation,
  reserveCoupon,
  validateCoupon,
} from "@/server/pricing/coupons-service";
import { ensurePricingSchema } from "@/server/pricing/pricing-schema";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { recomputeUserPremiumFlags } from "@/server/entitlements";

import {
  attachRazorpayOrderId,
  getOrderById,
  getOrderByIdempotencyKey,
  getOrderByRazorpayId,
  getPaymentById,
  insertOrder,
  newOrderId,
  setOrderStatus,
  upsertPayment,
  enqueueOutbox,
  type PaymentOrder,
  type PaymentRecord,
  type OrderKind,
} from "./payments-store";
import { ensurePaymentsAndGrantSchema, ensurePaymentsSchema } from "./payments-schema";
import {
  openInstituteEnrollmentOrder,
  resolveInstituteOffering,
} from "./institute-orders";
import { amountForTerm, type TermOption } from "./pricing-cache";
import { getRazorpayClient, getRazorpayKeyId, isLivemode } from "./razorpay-client";
import { grantPaidTerm, type PaidTermGrant } from "./grants";
import { publishOutbox } from "./qstash";
import {
  applyDisputeCreated,
  applyRefundLifecycle,
  disputeInputFromEvent,
  refundInputFromEvent,
} from "./refunds-service";

const CURRENCY = "INR";
const DEFAULT_ORDER_EXPIRY_MS = 30 * 60 * 1000;

type PaymentRecipient = { email: string | null; name: string | null };

async function paymentRecipient(
  client: Pick<import("pg").PoolClient, "query">,
  userId: string,
): Promise<PaymentRecipient> {
  const result = await client.query<{ email: string | null; name: string | null }>(
    `SELECT email, name FROM origin_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  return { email: row?.email?.trim() || null, name: row?.name?.trim() || null };
}

function latestGrantExpiry(grants: PaidTermGrant[]): string | null {
  return grants.reduce<string | null>((latest, grant) => {
    if (!latest || new Date(grant.expiresAt).getTime() > new Date(latest).getTime()) return grant.expiresAt;
    return latest;
  }, null);
}

export type RazorpayOrder = {
  id: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  notes?: Record<string, unknown>;
};

export type RazorpayOrdersClient = {
  orders: {
    create(input: {
      amount: number;
      currency: string;
      receipt?: string;
      notes?: Record<string, string | number>;
    }): Promise<RazorpayOrder>;
  };
};

/** A retryable gateway failure (routes map this to HTTP 503). */
export class PaymentGatewayError extends Error {
  readonly status = 503;
  readonly retryAfterSeconds = 10;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PaymentGatewayError";
  }
}

/** Every product Rail A can price. `institute_offering` landed with plan G16. */
export type RailAOrderKind = Extract<
  OrderKind,
  "subject_term" | "bundle_term" | "institute_offering"
>;

export type ResolveOrderAmountInput = {
  kind?: RailAOrderKind;
  subject?: Subject | string | null;
  bundleId?: string | null;
  /** institute_offering only. */
  workspaceId?: string | null;
  /** institute_offering only. */
  offeringId?: string | null;
  termMonths: number;
  couponCode?: string | null;
  userId?: string | null;
};

export type ResolvedOrderAmount = {
  kind: RailAOrderKind;
  subject: Subject | null;
  bundleId: string | null;
  bundleSubjects: Subject[];
  workspaceId: string | null;
  offeringId: string | null;
  /** Human label for the purchased item; only set for institute offerings. */
  offeringTitle: string | null;
  termMonths: number;
  baseMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: typeof CURRENCY;
  couponCode: string | null;
  /** Monthly source amount before the term ladder is applied. */
  monthlyMinor: number;
  term: TermOption;
};

export type CreateCheckoutOrderInput = {
  userId: string;
  subject: Subject | string;
  termMonths: number;
  bundleId?: string | null;
  /** institute_offering only. */
  workspaceId?: string | null;
  /** institute_offering only. */
  offeringId?: string | null;
  kind?: RailAOrderKind;
  couponCode?: string | null;
  idempotencyKey?: string | null;
  razorpayClient?: RazorpayOrdersClient;
  /** Test seam; production uses the mode-aware client. */
  keyId?: string;
  now?: Date;
};

export type CheckoutOrderResult = {
  order: PaymentOrder;
  orderId: string;
  razorpayOrderId: string | null;
  amountMinor: number;
  currency: typeof CURRENCY;
  keyId: string | null;
  /** True only when a zero-value order was settled without Razorpay. */
  paidWithoutGateway: boolean;
};

export type PaymentSuccessInput = {
  razorpayOrderId?: string | null;
  orderId?: string | null;
  razorpayPaymentId: string;
  amountMinor?: number | null;
  currency?: string | null;
  method?: string | null;
  feeMinor?: number | null;
  taxMinor?: number | null;
  raw?: Record<string, unknown>;
  /** Alias accepted by webhook adapters; merged with `raw` when supplied. */
  payment?: Record<string, unknown>;
  now?: Date;
};

export type PaymentSuccessResult = {
  order: PaymentOrder;
  payment: PaymentRecord;
  grants: PaidTermGrant[];
  alreadyApplied: boolean;
};

export type MarkOrderFailedInput = {
  orderId?: string | null;
  razorpayOrderId?: string | null;
  reason?: string | null;
  razorpayPaymentId?: string | null;
  payment?: Record<string, unknown>;
};

function dbPool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function dateOrNow(value?: Date): Date {
  const date = value ?? new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
  return date;
}

function normalizedSubject(value: Subject | string | null | undefined): Subject | null {
  if (typeof value !== "string") return value ?? null;
  const normalized = value.trim().toLowerCase();
  return isSubject(normalized) ? normalized : null;
}

function asMinor(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

async function getTermOption(termMonths: number): Promise<TermOption> {
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error("termMonths must be a positive integer");
  }
  await ensurePricingSchema();
  const result = await dbPool().query(
    `SELECT term_months, label, discount_percent
       FROM pricing.term_options
      WHERE term_months = $1 AND active = TRUE
      LIMIT 1`,
    [termMonths],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`The ${termMonths}-month term is not available`);
  return {
    termMonths: Number(row.term_months),
    label: String(row.label),
    discountPercent: Number(row.discount_percent) || 0,
  };
}

async function getBundleById(bundleId: string | null | undefined) {
  await ensurePricingSchema();
  if (!bundleId) return getActiveBundle();
  const result = await dbPool().query(
    `SELECT * FROM pricing.bundle_offers WHERE id = $1 AND active = TRUE LIMIT 1`,
    [bundleId],
  );
  if (!result.rows[0]) throw new Error("The selected bundle is not available");
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name),
    subjects: Array.isArray(row.subjects) ? row.subjects.map(String) : [],
    amountMinor: Number(row.amount_minor) || 0,
    currency: String(row.currency ?? CURRENCY),
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
    active: Boolean(row.active),
  };
}

/**
 * Resolves the frozen amount for a one-time order. The request amount is never
 * accepted; only the selected subject/bundle and term are inputs.
 */
export async function resolveOrderAmount(input: ResolveOrderAmountInput): Promise<ResolvedOrderAmount> {
  const subject = normalizedSubject(input.subject);
  const kind =
    input.kind ??
    (input.offeringId ? "institute_offering" : input.bundleId ? "bundle_term" : "subject_term");
  if (kind === "subject_term" && !subject) throw new Error("A valid subject is required");
  if (kind === "bundle_term" && subject && !input.bundleId) {
    // A bundle request may carry a subject for compatibility, but pricing is
    // still resolved from the bundle and never from that subject's amount.
  }

  // An institute offering is a one-time enrolment fee set by the institute, not
  // a platform subscription: the term ladder and platform coupons do not apply
  // to it, and its price comes from commerce.workspace_offerings (plan G16).
  if (kind === "institute_offering") {
    if (!input.workspaceId || !input.offeringId) {
      throw new Error("workspaceId and offeringId are required for an institute offering");
    }
    if (input.couponCode?.trim()) {
      throw new Error("Coupons do not apply to institute offerings");
    }
    const target = await resolveInstituteOffering({
      workspaceId: input.workspaceId,
      offeringId: input.offeringId,
    });
    return {
      kind,
      subject: null,
      bundleId: null,
      bundleSubjects: [],
      workspaceId: target.workspaceId,
      offeringId: target.offeringId,
      offeringTitle: target.title,
      termMonths: 1,
      baseMinor: target.amountMinor,
      discountMinor: 0,
      amountMinor: target.amountMinor,
      currency: CURRENCY,
      couponCode: null,
      monthlyMinor: target.amountMinor,
      term: { termMonths: 1, label: "One-time", discountPercent: 0 },
    };
  }

  const term = await getTermOption(input.termMonths);
  let monthlyMinor = 0;
  let bundleId: string | null = null;
  let bundleSubjects: Subject[] = [];

  if (kind === "subject_term") {
    const price = await getSubjectPriceResolved(subject as Subject);
    monthlyMinor = Math.max(0, Math.round(price.amountMinor));
  } else {
    const bundle = await getBundleById(input.bundleId);
    if (!bundle) throw new Error("No active bundle is configured");
    monthlyMinor = Math.max(0, Math.round(bundle.amountMinor));
    bundleId = bundle.id;
    bundleSubjects = Array.from(
      new Set(bundle.subjects.filter((value): value is Subject => isSubject(value))),
    );
    if (bundleSubjects.length === 0) throw new Error("The selected bundle has no valid subjects");
  }

  const baseMinor = amountForTerm(monthlyMinor, term);
  let discountMinor = 0;
  let couponCode: string | null = null;
  if (input.couponCode?.trim()) {
    requireFeatureEnabled("adminCoupons");
    if (!input.userId) throw new Error("userId is required when applying a coupon");
    const coupon = await validateCoupon({
      code: input.couponCode,
      userId: input.userId,
      target: {
        kind: kind === "bundle_term" ? "bundle" : "subject",
        subject: subject ?? undefined,
        baseAmountMinor: baseMinor,
      },
    });
    if (!coupon.valid) throw new Error(coupon.reason);
    discountMinor = Math.max(0, Math.min(baseMinor, coupon.discountMinor));
    couponCode = coupon.code;
  }

  return {
    kind,
    subject: kind === "subject_term" ? subject : null,
    bundleId,
    bundleSubjects,
    workspaceId: null,
    offeringId: null,
    offeringTitle: null,
    termMonths: term.termMonths,
    baseMinor,
    discountMinor,
    amountMinor: Math.max(0, baseMinor - discountMinor),
    currency: CURRENCY,
    couponCode,
    monthlyMinor,
    term,
  };
}

function checkoutNotes(input: {
  userId: string;
  orderId: string;
  resolved: ResolvedOrderAmount;
  /** institute_offering only: the commerce.enrollment_orders row being paid. */
  enrollmentOrderId?: string | null;
}): Record<string, string | number> {
  const { resolved } = input;
  return {
    origin_order_id: input.orderId,
    origin_user_id: input.userId,
    origin_kind: resolved.kind,
    origin_term_months: resolved.termMonths,
    ...(resolved.subject ? { origin_subject: resolved.subject } : {}),
    ...(resolved.bundleId ? { origin_bundle_id: resolved.bundleId } : {}),
    ...(resolved.workspaceId ? { origin_workspace_id: resolved.workspaceId } : {}),
    ...(resolved.offeringId ? { origin_offering_id: resolved.offeringId } : {}),
    ...(input.enrollmentOrderId ? { origin_enrollment_order_id: input.enrollmentOrderId } : {}),
  };
}

/** Creates a local order first, then asks Razorpay to create its external order. */
export async function createCheckoutOrder(input: CreateCheckoutOrderInput): Promise<CheckoutOrderResult> {
  if (!input.userId) throw new Error("userId is required");
  if (!isUserPostgresConfigured()) throw new Error("USER_DATABASE_URL is not configured");

  const resolved = await resolveOrderAmount({
    kind:
      input.kind ??
      (input.offeringId ? "institute_offering" : input.bundleId ? "bundle_term" : "subject_term"),
    subject: input.subject,
    bundleId: input.bundleId,
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    termMonths: input.termMonths,
    couponCode: input.couponCode,
    userId: input.userId,
  });

  // The DB unique index remains the final arbiter under a race. This lookup
  // gives direct callers the same replay semantics as the route idempotency
  // wrapper when a completed order already exists.
  if (input.idempotencyKey) {
    const existing = await getOrderByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existing) {
      let replayKeyId: string | null = safeKeyId(input.keyId);
      if (!replayKeyId && !input.razorpayClient && existing.amountMinor > 0) {
        try {
          replayKeyId = getRazorpayKeyId();
        } catch {
          replayKeyId = null;
        }
      }
      return {
        order: existing,
        orderId: existing.id,
        razorpayOrderId: existing.razorpayOrderId,
        amountMinor: existing.amountMinor,
        currency: existing.currency as typeof CURRENCY,
        keyId: existing.amountMinor > 0 ? replayKeyId : null,
        paidWithoutGateway: existing.amountMinor === 0,
      };
    }
  }

  const now = dateOrNow(input.now);
  const orderId = newOrderId();

  // An institute purchase pays for a commerce.enrollment_orders row. Open (or
  // reuse) it BEFORE the money order exists, so a capture always has a target
  // to enrol against — plan G16.
  let enrollmentOrderId: string | null = null;
  if (resolved.kind === "institute_offering") {
    const commerceOrder = await openInstituteEnrollmentOrder({
      workspaceId: resolved.workspaceId as string,
      offeringId: resolved.offeringId as string,
      studentId: input.userId,
    });
    if (commerceOrder.status === "paid") {
      const err = new Error("This offering has already been purchased.");
      (err as { status?: number }).status = 409;
      throw err;
    }
    enrollmentOrderId = commerceOrder.id;
  }

  const order = await insertOrder({
    id: orderId,
    userId: input.userId,
    kind: resolved.kind,
    subject: resolved.subject,
    bundleId: resolved.bundleId,
    workspaceId: resolved.workspaceId,
    offeringId: resolved.offeringId,
    termMonths: resolved.termMonths,
    baseAmountMinor: resolved.baseMinor,
    discountMinor: resolved.discountMinor,
    amountMinor: resolved.amountMinor,
    currency: CURRENCY,
    couponCode: resolved.couponCode,
    livemode: isLivemode(),
    idempotencyKey: input.idempotencyKey ?? null,
    notes: {
      ...checkoutNotes({ userId: input.userId, orderId, resolved, enrollmentOrderId }),
      bundle_subjects: resolved.bundleSubjects,
      ...(enrollmentOrderId ? { enrollment_order_id: enrollmentOrderId } : {}),
      ...(resolved.offeringTitle ? { offering_title: resolved.offeringTitle } : {}),
    },
    expiresAt: new Date(now.getTime() + DEFAULT_ORDER_EXPIRY_MS),
  });

  if (resolved.couponCode) {
    try {
      await reserveCoupon({
        code: resolved.couponCode,
        userId: input.userId,
        subject: resolved.subject,
        targetKind: resolved.kind === "bundle_term" ? "bundle" : "subject",
        orderId: order.id,
        amountDiscountedMinor: resolved.discountMinor,
        expiresAt: order.expiresAt ? new Date(order.expiresAt) : undefined,
      });
    } catch (error) {
      // Do not leave an order pointing at a coupon it could not reserve. The
      // failed row is retained for audit/retry, while its reservation (if a
      // concurrent retry had created one) is released by the failure path.
      await markOrderFailed({
        orderId: order.id,
        reason: error instanceof Error ? error.message : "Coupon reservation failed",
      }).catch(() => undefined);
      throw error;
    }
  }

  // Full coupon discounts are useful for local/test operations and are safe:
  // no external charge is made, but the order is still ledgered and granted.
  if (resolved.amountMinor === 0) {
    const syntheticPaymentId = `coupon_${order.id}`;
    try {
      await applyPaymentSuccess({
        orderId: order.id,
        razorpayPaymentId: syntheticPaymentId,
        amountMinor: 0,
        currency: CURRENCY,
        method: "coupon_full",
        raw: { origin: "coupon_full" },
        now,
      });
    } catch (error) {
      await markOrderFailed({
        orderId: order.id,
        reason: error instanceof Error ? error.message : "Coupon settlement failed",
      }).catch(() => undefined);
      throw error;
    }
    return {
      order: (await getOrderById(order.id)) ?? order,
      orderId: order.id,
      razorpayOrderId: null,
      amountMinor: 0,
      currency: CURRENCY,
      keyId: null,
      paidWithoutGateway: true,
    };
  }

  try {
    let client: RazorpayOrdersClient;
    try {
      client = input.razorpayClient ?? (getRazorpayClient() as unknown as RazorpayOrdersClient);
    } catch (error) {
      throw new PaymentGatewayError(
        error instanceof Error ? error.message : "Razorpay is not configured",
        { cause: error },
      );
    }
    let external: RazorpayOrder;
    try {
      external = await client.orders.create({
        amount: resolved.amountMinor,
        currency: CURRENCY,
        receipt: order.id.slice(0, 40),
        notes: checkoutNotes({ userId: input.userId, orderId, resolved, enrollmentOrderId }),
      });
    } catch (error) {
      throw new PaymentGatewayError(
        error instanceof Error ? error.message : "Razorpay order creation failed",
        { cause: error },
      );
    }
    if (!external?.id) throw new Error("Razorpay did not return an order id");
    const attached = await attachRazorpayOrderId(order.id, String(external.id));
    if (!attached) {
      // The external order carries origin_order_id in notes; reconciliation can
      // heal this rare DB failure without losing the money-bearing intent.
      throw new PaymentGatewayError("Razorpay order created but could not be attached locally");
    }
    return {
      order: attached,
      orderId: attached.id,
      razorpayOrderId: attached.razorpayOrderId,
      amountMinor: attached.amountMinor,
      currency: CURRENCY,
      keyId: input.keyId ?? (input.razorpayClient ? null : getRazorpayKeyId()),
      paidWithoutGateway: false,
    };
  } catch (error) {
    await markOrderFailed({
      orderId: order.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function safeKeyId(keyId?: string): string | null {
  return keyId?.trim() || null;
}

function paymentDataFromRaw(raw: Record<string, unknown> | undefined): {
  amountMinor: number | null;
  currency: string | null;
  method: string | null;
  feeMinor: number | null;
  taxMinor: number | null;
} {
  const entity = (raw?.payload as Record<string, unknown> | undefined) ?? raw ?? {};
  const payment = (entity.payment as Record<string, unknown> | undefined) ?? entity;
  const entityData = (payment.entity as Record<string, unknown> | undefined) ?? payment;
  return {
    amountMinor: asMinor(entityData.amount),
    currency: entityData.currency == null ? null : String(entityData.currency),
    method: entityData.method == null ? null : String(entityData.method),
    feeMinor: asMinor(entityData.fee),
    taxMinor: asMinor(entityData.tax),
  };
}

async function findOrder(input: PaymentSuccessInput | MarkOrderFailedInput): Promise<PaymentOrder | null> {
  if (input.orderId) return getOrderById(input.orderId);
  if (input.razorpayOrderId) return getOrderByRazorpayId(input.razorpayOrderId);
  return null;
}

/**
 * Applies one captured payment and grants access exactly once.
 *
 * The payment id is the idempotency key. A transaction-scoped advisory lock on
 * the user serialises webhook and browser-verify races without locking unrelated
 * students. Existing captured rows return immediately and never extend a term
 * twice.
 */
export async function applyPaymentSuccess(input: PaymentSuccessInput): Promise<PaymentSuccessResult> {
  if (!input.razorpayPaymentId) throw new Error("razorpayPaymentId is required");
  await ensurePaymentsAndGrantSchema();
  const orderBefore = await findOrder(input);
  if (!orderBefore) throw new Error("Payment refers to an unknown order");
  if (
    orderBefore.kind !== "subject_term" &&
    orderBefore.kind !== "bundle_term" &&
    orderBefore.kind !== "institute_offering"
  ) {
    throw new Error("Payment order is not a Rail A order");
  }

  const client = await dbPool().connect();
  let result: PaymentSuccessResult;
  try {
    await client.query("BEGIN");
    const lockedOrderResult = await client.query(
      `SELECT * FROM payments.orders
        WHERE id = $1
        FOR UPDATE`,
      [orderBefore.id],
    );
    const row = lockedOrderResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("Payment refers to an unknown order");
    const order = (await getOrderById(String(row.id), client)) as PaymentOrder;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [order.userId]);

    if (input.razorpayOrderId && order.razorpayOrderId !== input.razorpayOrderId) {
      throw new Error("Payment order id does not match the local order");
    }

    const existingPayment = await client.query(
      `SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
      [input.razorpayPaymentId],
    );
    const existing = existingPayment.rows[0] as Record<string, unknown> | undefined;
    const raw = input.raw ?? input.payment;
    const rawData = paymentDataFromRaw(raw);
    const amountMinor = input.amountMinor ?? rawData.amountMinor ?? order.amountMinor;
    const currency = (input.currency ?? rawData.currency ?? CURRENCY).toUpperCase();
    if (currency !== CURRENCY) throw new Error("Only INR payments are accepted");
    if (amountMinor !== order.amountMinor) {
      throw new Error("Captured amount does not match the order amount");
    }

    // A second payment id must never extend an already-paid order. This can
    // happen if Razorpay retries a capture with a distinct id or an operator
    // manually captures twice. Return the original ledger row idempotently.
    if (!existing && order.status === "paid") {
      const priorResult = await client.query(
        `SELECT razorpay_payment_id FROM payments.payments
          WHERE order_id = $1 AND status = 'captured'
          ORDER BY captured_at ASC NULLS LAST LIMIT 1`,
        [order.id],
      );
      const priorId = priorResult.rows[0]?.razorpay_payment_id as string | undefined;
      if (priorId) {
        await client.query("COMMIT");
        const prior = await getPaymentById(priorId);
        if (!prior) throw new Error("Paid order payment ledger is missing");
        result = { order, payment: prior, grants: [], alreadyApplied: true };
      } else {
        throw new Error("Order is already paid but has no captured payment");
      }
    } else if (existing && String(existing.status) === "refunded") {
      if (existing.order_id && String(existing.order_id) !== order.id) {
        throw new Error("Payment id is already linked to a different order");
      }
      // Razorpay may redeliver the original capture after a full refund. The
      // refund is terminal for this payment/order pair: acknowledge the stale
      // capture without restoring the ledger status or entitlement.
      const payment = await getPaymentById(input.razorpayPaymentId, client);
      if (!payment) throw new Error("Refunded payment ledger is missing");
      const current = (await getOrderById(order.id, client)) as PaymentOrder;
      await client.query("COMMIT");
      result = { order: current, payment, grants: [], alreadyApplied: true };
    } else if (existing && String(existing.status) === "captured") {
      if (existing.order_id && String(existing.order_id) !== order.id) {
        throw new Error("Payment id is already linked to a different order");
      }
      const capturedAt = dateOrNow(input.now);
      const payment = await upsertPayment(
        {
          razorpayPaymentId: input.razorpayPaymentId,
          orderId: order.id,
          userId: order.userId,
          amountMinor,
          currency: CURRENCY,
          method: input.method ?? rawData.method,
          status: "captured",
          feeMinor: input.feeMinor ?? rawData.feeMinor,
          taxMinor: input.taxMinor ?? rawData.taxMinor,
          livemode: order.livemode,
          capturedAt,
          raw,
        },
        client,
      );
      const current = (await getOrderById(order.id, client)) as PaymentOrder;
      await client.query("COMMIT");
      result = { order: current, payment, grants: [], alreadyApplied: true };
    } else {
      if (existing?.order_id && String(existing.order_id) !== order.id) {
        throw new Error("Payment id is already linked to a different order");
      }
      const capturedAt = dateOrNow(input.now);
      const payment = await upsertPayment(
        {
          razorpayPaymentId: input.razorpayPaymentId,
          orderId: order.id,
          userId: order.userId,
          amountMinor,
          currency: CURRENCY,
          method: input.method ?? rawData.method,
          status: "captured",
          feeMinor: input.feeMinor ?? rawData.feeMinor,
          taxMinor: input.taxMinor ?? rawData.taxMinor,
          livemode: order.livemode,
          capturedAt,
          raw,
        },
        client,
      );

      const grants: PaidTermGrant[] = [];
      // An institute offering buys enrolment in someone else's batch, not a
      // platform subject entitlement, so it grants nothing here — the commerce
      // side effect is enqueued below and runs after commit (plan G16).
      if (order.kind !== "institute_offering") {
        const subjects = order.kind === "subject_term"
          ? [order.subject as Subject]
          : (Array.isArray(order.notes.bundle_subjects)
              ? Array.from(new Set(order.notes.bundle_subjects.filter((s): s is Subject => isSubject(s))))
              : ALL_SUBJECTS);
        for (const subject of subjects) {
          grants.push(
            await grantPaidTerm({
              userId: order.userId,
              subject,
              termMonths: order.termMonths,
              orderId: order.id,
              client,
              paidAt: capturedAt,
              now: capturedAt,
            }),
          );
        }
      }
      // `paidAt: capturedAt` keeps payments.orders.paid_at on the same clock as
      // payments.payments.captured_at. The grant rebase above reads whichever is
      // present, so two clocks would order two purchases by when their webhooks
      // happened to be processed rather than by when they were paid.
      const updated = await setOrderStatus(order.id, "paid", { paidAt: capturedAt }, client);
      if (!updated) throw new Error("Order could not be marked paid");
      if (order.couponCode) {
        await commitCouponReservation(
          { code: order.couponCode, userId: order.userId, orderId: order.id },
          client,
        );
      }
      // Institute purchases enrol the student. Doing that inside this
      // transaction would drag enrollments, batches and the audit log into the
      // money commit; the outbox gives durability without that coupling, and
      // markOrderPaidService is idempotent so a retry cannot double-enrol.
      if (order.kind === "institute_offering") {
        const enrollmentOrderId =
          typeof order.notes.enrollment_order_id === "string" ? order.notes.enrollment_order_id : null;
        if (!enrollmentOrderId || !order.workspaceId) {
          throw new Error("Institute order is missing its enrollment order reference");
        }
        await enqueueOutbox(
          {
            id: `institute_enrollment_${input.razorpayPaymentId}`,
            kind: "institute_enrollment",
            payload: {
              userId: order.userId,
              orderId: order.id,
              enrollmentOrderId,
              workspaceId: order.workspaceId,
              offeringId: order.offeringId,
              paymentId: input.razorpayPaymentId,
            },
          },
          client,
        );
      }

      const recipient = await paymentRecipient(client, order.userId);
      // The row id is derived from the Razorpay payment id.  This makes the
      // receipt enqueue idempotent across verify/webhook convergence while the
      // insert still lives in the same transaction as the grant and payment.
      await enqueueOutbox(
        {
          id: `payment_receipt_${input.razorpayPaymentId}`,
          kind: "receipt_email",
          payload: {
            userId: order.userId,
            to: recipient.email,
            studentName: recipient.name,
            orderId: order.id,
            paymentId: input.razorpayPaymentId,
            amountMinor: order.amountMinor,
            currency: order.currency,
            kind: order.kind,
            subject: order.subject,
            termMonths: order.termMonths,
            paidAt: updated.paidAt,
            expiresAt: latestGrantExpiry(grants),
            href: order.kind === "institute_offering" ? "/connect" : "/premium",
            ...(order.kind === "institute_offering"
              ? {
                  notificationTitle: "Payment received",
                  notificationMessage: `Your payment for ${
                    typeof order.notes.offering_title === "string" ? order.notes.offering_title : "your enrolment"
                  } was received. Your enrolment is being set up.`,
                }
              : {}),
          },
        },
        client,
      );
      await client.query("COMMIT");
      // Recompute after commit: the entitlement union uses a separate pool
      // connection and must never observe an uncommitted grant. An institute
      // order grants no subject entitlement, so there is nothing to recompute.
      if (order.kind !== "institute_offering") await recomputeUserPremiumFlags(order.userId);
      if (order.kind === "institute_offering") {
        await publishOutbox(`institute_enrollment_${input.razorpayPaymentId}`).catch(() => undefined);
      }
      await publishOutbox(`payment_receipt_${input.razorpayPaymentId}`).catch(() => undefined);
      result = { order: updated, payment, grants, alreadyApplied: false };
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return result;
}

/** Marks a checkout failed; guarded store semantics prevent paid -> failed. */
export async function markOrderFailed(input: MarkOrderFailedInput): Promise<PaymentOrder | null> {
  // Failure events only touch the payments ledger; avoid making a webhook for
  // an unknown/early order wait on the entitlement/pricing DDL ensures.
  await ensurePaymentsSchema();
  const order = await findOrder(input);
  if (!order) return null;
  const client = await dbPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await getOrderById(order.id, client);
    if (!locked) {
      await client.query("COMMIT");
      return null;
    }
    const updated = await setOrderStatus(
      locked.id,
      "failed",
      {
        failureReason: (input.reason ?? "payment_failed").slice(0, 2000),
        clearIdempotencyKey: true,
      },
      client,
    );
    if (updated && locked.status !== "failed" && updated.status === "failed") {
      if (locked.couponCode) {
        await releaseCouponReservation(
          { code: locked.couponCode, userId: locked.userId, orderId: locked.id },
          client,
        );
      }
      const recipient = await paymentRecipient(client, locked.userId);
      await enqueueOutbox(
        {
          id: `payment_failed_${locked.id}`,
          kind: "payment_failed_email",
          payload: {
            userId: locked.userId,
            to: recipient.email,
            studentName: recipient.name,
            orderId: locked.id,
            paymentId: input.razorpayPaymentId ?? null,
            amountMinor: locked.amountMinor,
            currency: locked.currency,
            kind: locked.kind,
            subject: locked.subject,
            termMonths: locked.termMonths,
            failureReason: input.reason ?? "payment_failed",
            retryHref: "/premium",
            href: "/premium",
          },
        },
        client,
      );
    }
    await client.query("COMMIT");
    await publishOutbox(`payment_failed_${locked.id}`).catch(() => undefined);
    return updated ?? locked;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Existing route naming convention compatibility. */
export const markOrderFailedService = markOrderFailed;

export type PaymentEventInput = {
  event?: string | null;
  payload?: Record<string, unknown>;
  livemode?: boolean;
};

/** Applies the supported Rail A webhook event shapes. */
export async function processPaymentEvent(input: PaymentEventInput | Record<string, unknown>) {
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

  if (event === "refund.created" || event === "refund.processed") {
    return applyRefundLifecycle(refundInputFromEvent(body));
  }
  if (event === "payment.dispute.created") {
    return applyDisputeCreated(disputeInputFromEvent(body));
  }

  if (event === "payment.failed" || event.endsWith(".failed")) {
    const failed = await markOrderFailed({
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
    return applyPaymentSuccess({
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
