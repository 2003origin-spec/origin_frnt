/**
 * Bounded, resumable payment reconciliation and dunning pass (Phase 7).
 *
 * The gateway adapter is injectable so every decision can be exercised with a
 * deterministic stub. No production database or Razorpay call is needed for
 * the pure helpers and the unit suite.
 */

import { metric } from "@/lib/metrics";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { releaseCouponReservation } from "@/server/pricing/coupons-service";
import { ensurePricingSchema } from "@/server/pricing/pricing-schema";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import {
  expireLapsedSubscriptions,
  listFailedMandateSubscriptions,
} from "@/server/subscriptions/subscriptions-store";
import { reconcileEnrollmentSubscriptions } from "@/server/connect/enrollment-subscription-service";
import { listFailedMandateEnrollmentSubscriptions } from "@/server/connect/enrollment-subscriptions-store";

import { applyPaymentSuccess } from "./orders-service";
import {
  enqueueOutbox,
  expireOrder,
  listOpenOrdersForUser,
  listReconciliationOrders,
  type PaymentOrder,
} from "./payments-store";
import { ensurePaymentsAndGrantSchema } from "./payments-schema";
import { getRazorpayClient } from "./razorpay-client";
import {
  decideReconciliationAction,
  deterministicDunningOutboxId,
  expiryWarningDays,
  failedMandateDunningDays,
} from "./reconciliation-policy";

export {
  decideReconciliationAction,
  deterministicDunningOutboxId,
  expiryWarningDays,
  failedMandateDunningDays,
  reconciliationDecision,
} from "./reconciliation-policy";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RazorpayOrderSnapshot = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, unknown>;
  created_at?: number;
};

export type RazorpayPaymentSnapshot = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  fee?: number;
  tax?: number;
  created_at?: number;
};

export type RazorpayReconciliationAdapter = {
  orders: {
    fetch(orderId: string): Promise<RazorpayOrderSnapshot>;
    fetchPayments(orderId: string): Promise<{ items?: RazorpayPaymentSnapshot[] } | RazorpayPaymentSnapshot[]>;
  };
};

function pool() {
  const value = getUserPostgresPool();
  if (!value) throw new Error("USER_DATABASE_URL is not configured");
  return value;
}

function asInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function epochDate(value: unknown): Date | null {
  const seconds = asInteger(value);
  if (seconds == null) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function paymentItems(value: { items?: RazorpayPaymentSnapshot[] } | RazorpayPaymentSnapshot[]): RazorpayPaymentSnapshot[] {
  return Array.isArray(value) ? value : Array.isArray(value.items) ? value.items : [];
}

async function expireOrderAndReleaseCoupon(order: PaymentOrder): Promise<boolean> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const expired = await expireOrder(order.id, "checkout_expired", client);
    if (expired?.couponCode) {
      await releaseCouponReservation(
        { code: expired.couponCode, userId: expired.userId, orderId: expired.id },
        client,
      );
    }
    await client.query("COMMIT");
    return Boolean(expired);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function reconcileOrders(input: {
  now: Date;
  limit: number;
  adapter: RazorpayReconciliationAdapter;
}): Promise<{ inspected: number; captured: number; expired: number; waiting: number; errors: number }> {
  const orders = await listReconciliationOrders({
    olderThan: new Date(input.now.getTime() - FIFTEEN_MINUTES_MS),
    limit: input.limit,
  });
  const result = { inspected: orders.length, captured: 0, expired: 0, waiting: 0, errors: 0 };
  for (const order of orders) {
    try {
      let external: RazorpayOrderSnapshot | null = null;
      let payments: RazorpayPaymentSnapshot[] = [];
      if (order.razorpayOrderId) {
        external = await input.adapter.orders.fetch(order.razorpayOrderId);
        payments = paymentItems(await input.adapter.orders.fetchPayments(order.razorpayOrderId));
      }
      const captured = payments.find(
        (payment) => payment.status === "captured" && (!payment.order_id || payment.order_id === order.razorpayOrderId),
      ) ?? null;
      const action = decideReconciliationAction({
        externalStatus: external?.status,
        capturedPayment: captured,
        expiresAt: order.expiresAt,
        createdAt: order.createdAt,
        now: input.now,
      });
      if (action === "captured" && captured?.id) {
        await applyPaymentSuccess({
          orderId: order.id,
          razorpayOrderId: order.razorpayOrderId,
          razorpayPaymentId: captured.id,
          amountMinor: asInteger(captured.amount),
          currency: captured.currency ?? "INR",
          method: captured.method ?? null,
          feeMinor: asInteger(captured.fee),
          taxMinor: asInteger(captured.tax),
          raw: { origin: "reconciliation", order: external, payment: captured },
          now: epochDate(captured.created_at) ?? input.now,
        });
        result.captured += 1;
      } else if (action === "expire") {
        if (await expireOrderAndReleaseCoupon(order)) result.expired += 1;
      } else {
        result.waiting += 1;
      }
    } catch (error) {
      result.errors += 1;
      metric("origin.payments.reconcile.order_error", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

async function emitPrepaidDunning(now: Date, limit: number): Promise<number> {
  const result = await pool().query(
    `SELECT g.id, g.user_id, g.subject, g.order_id, g.expires_at,
            u.email, u.name, o.kind, o.term_months
       FROM entitlements.subject_grants g
       JOIN origin_users u ON u.id = g.user_id
       LEFT JOIN payments.orders o ON o.id = g.order_id
      WHERE g.source = 'paid_order' AND g.status = 'active'
        AND g.expires_at IS NOT NULL
        AND g.expires_at > $1
        AND g.expires_at <= $1 + INTERVAL '8 days'
      ORDER BY g.expires_at ASC, g.id ASC
      LIMIT $2`,
    [now, Math.min(Math.max(limit, 1), 500)],
  );
  let emitted = 0;
  for (const row of result.rows) {
    const days = expiryWarningDays(row.expires_at, now);
    if (days == null) continue;
    const id = deterministicDunningOutboxId({ kind: "expiry_warning", sourceId: String(row.id), milestone: days });
    await enqueueOutbox({
      id,
      kind: "dunning_email",
      payload: {
        userId: String(row.user_id),
        to: row.email,
        studentName: row.name,
        orderId: row.order_id,
        subject: row.subject,
        kind: row.kind ?? "subject_term",
        termMonths: Number(row.term_months) || 1,
        expiresAt: new Date(row.expires_at).toISOString(),
        daysUntilExpiry: days,
        dunningKind: "expiry_warning",
        retryHref: "/premium",
        href: "/premium",
      },
    });
    emitted += 1;
  }
  return emitted;
}

async function emitMandateDunning(now: Date, limit: number): Promise<number> {
  const [subjectSubscriptions, enrollmentSubscriptions] = await Promise.all([
    listFailedMandateSubscriptions(),
    listFailedMandateEnrollmentSubscriptions(),
  ]);
  const rows = [
    ...subjectSubscriptions.map((row) => ({
      sourceId: `subject_${row.id}`,
      userId: row.userId,
      subject: row.subject as string | null,
      status: row.status,
      updatedAt: row.updatedAt,
      currentPeriodEnd: row.currentPeriodEnd,
      kind: "subject_subscription",
      retryHref: "/premium",
      workspaceId: null as string | null,
      offeringId: null as string | null,
    })),
    ...enrollmentSubscriptions.map((row) => ({
      sourceId: `connect_${row.id}`,
      userId: row.studentId,
      subject: null as string | null,
      status: row.status,
      updatedAt: row.updatedAt,
      currentPeriodEnd: row.currentPeriodEnd,
      kind: "batch_subscription",
      retryHref: "/connect",
      workspaceId: row.workspaceId,
      offeringId: row.offeringId,
    })),
  ]
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.sourceId.localeCompare(right.sourceId))
    .slice(0, Math.min(Math.max(limit, 1), 500));

  let emitted = 0;
  for (const row of rows) {
    const days = failedMandateDunningDays(row.updatedAt, now);
    if (days == null) continue;
    const user = await pool().query(`SELECT email, name FROM origin_users WHERE id = $1`, [row.userId]);
    const id = deterministicDunningOutboxId({ kind: "mandate_failed", sourceId: row.sourceId, milestone: days });
    await enqueueOutbox({
      id,
      kind: "dunning_email",
      payload: {
        userId: row.userId,
        to: user.rows[0]?.email ?? null,
        studentName: user.rows[0]?.name ?? null,
        subject: row.subject,
        workspaceId: row.workspaceId,
        offeringId: row.offeringId,
        subscriptionStatus: row.status,
        kind: row.kind,
        expiresAt: row.currentPeriodEnd,
        daysUntilExpiry: row.currentPeriodEnd
          ? Math.max(0, Math.ceil((new Date(row.currentPeriodEnd).getTime() - now.getTime()) / DAY_MS))
          : null,
        dunningKind: "mandate_failed",
        retryHref: row.retryHref,
        href: row.retryHref,
      },
    });
    emitted += 1;
  }
  return emitted;
}

async function releaseStaleReservations(now: Date, limit: number): Promise<number> {
  await ensurePricingSchema();
  const rows = await pool().query(
    `SELECT r.code, r.user_id, r.order_id, r.subscription_id
       FROM pricing.coupon_redemptions r
       LEFT JOIN payments.orders o ON o.id = r.order_id
      WHERE r.state = 'reserved'
        AND (
          r.expires_at <= $1
          OR (r.redeemed_at <= $1 - INTERVAL '30 minutes' AND (o.status IS NULL OR o.status IN ('failed', 'expired')))
        )
      ORDER BY r.redeemed_at ASC, r.id ASC
      LIMIT $2`,
    [now, Math.min(Math.max(limit, 1), 500)],
  );
  let released = 0;
  for (const row of rows.rows) {
    if (await releaseCouponReservation({
      code: String(row.code),
      userId: String(row.user_id),
      orderId: row.order_id ? String(row.order_id) : null,
      subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    })) released += 1;
  }
  return released;
}

export type ReconciliationResult = {
  orders: Awaited<ReturnType<typeof reconcileOrders>>;
  subscriptionsExpired: number;
  connectSubscriptionsExpired: number;
  connectTornDown: number;
  couponsReleased: number;
  dunningEmitted: number;
};

/** Runs one bounded/resumable reconciliation pass. */
export async function reconcilePayments(input: {
  now?: Date;
  limit?: number;
  adapter?: RazorpayReconciliationAdapter;
} = {}): Promise<ReconciliationResult> {
  if (!isUserPostgresConfigured()) {
    return {
      orders: { inspected: 0, captured: 0, expired: 0, waiting: 0, errors: 0 },
      subscriptionsExpired: 0,
      connectSubscriptionsExpired: 0,
      connectTornDown: 0,
      couponsReleased: 0,
      dunningEmitted: 0,
    };
  }
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 200);
  await ensurePaymentsAndGrantSchema();
  const adapter = input.adapter ?? (getRazorpayClient() as unknown as RazorpayReconciliationAdapter);
  const orders = await reconcileOrders({ now, limit, adapter });

  const expired = await expireLapsedSubscriptions(now);
  for (const userId of expired.userIds) await recomputeUserPremiumFlags(userId);

  let connectTornDown = 0;
  try {
    connectTornDown = (await reconcileEnrollmentSubscriptions()).tornDown;
  } catch (error) {
    metric("origin.payments.reconcile.connect_error", { error: error instanceof Error ? error.message : String(error) });
  }

  const couponsReleased = await releaseStaleReservations(now, limit * 4);
  const dunningEmitted = (await emitPrepaidDunning(now, limit * 4)) +
    (await emitMandateDunning(now, limit * 4));
  metric("origin.payments.reconcile.completed", {
    inspected: orders.inspected,
    captured: orders.captured,
    expired: orders.expired,
  });
  return {
    orders,
    subscriptionsExpired: expired.subscriptions.length,
    connectSubscriptionsExpired: connectTornDown,
    connectTornDown,
    couponsReleased,
    dunningEmitted,
  };
}

/** Account-deletion helper: close local open orders and release coupon holds. */
export async function closeOpenPaymentOrdersForUser(userId: string): Promise<{
  closed: number;
  externalOrderIds: string[];
}> {
  if (!isUserPostgresConfigured()) return { closed: 0, externalOrderIds: [] };
  await ensurePaymentsAndGrantSchema();
  const orders = await listOpenOrdersForUser(userId);
  let closed = 0;
  const externalOrderIds: string[] = [];
  for (const order of orders) {
    if (order.razorpayOrderId) externalOrderIds.push(order.razorpayOrderId);
    if (await expireOrderAndReleaseCoupon(order)) closed += 1;
  }
  return { closed, externalOrderIds };
}
