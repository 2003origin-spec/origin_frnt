/**
 * Rail B + Connect → unified payments ledger (plan Phase 6).
 *
 * The two recurring rails (platform subject subscriptions and Connect batch
 * tuition) each keep their own webhook-idempotency ledger and their own
 * subscription table. This module is the shared, additive bridge that also
 * lands every one of their events in `payments.events` and every one of their
 * invoice charges in `payments.payments`, so the money ledger is complete
 * regardless of which rail took the payment.
 *
 * Nothing here is load-bearing for the legacy rails' correctness: their
 * existing ledgers stay the idempotency authority, so an in-flight event
 * during the deploy that introduces this module cannot be lost.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensurePaymentsSchema } from "./payments-schema";
import {
  enqueueOutbox,
  recordEvent,
  setEventStatus,
  upsertPayment,
  type PaymentRecord,
} from "./payments-store";
import { publishOutbox } from "./qstash";
import { isLivemode } from "./razorpay-client";

/** Which recurring rail an event arrived on. Stamped into the outbox payload. */
export type SubscriptionRail = "platform" | "connect";

export type SubscriptionChargeEntity = {
  razorpayPaymentId: string;
  amountMinor: number;
  currency: string;
  method: string | null;
  status: string;
  razorpayInvoiceId: string | null;
  feeMinor: number | null;
  taxMinor: number | null;
  capturedAt: Date | null;
};

export type ParsedSubscriptionEvent = {
  eventType: string | null;
  /** Razorpay's own event time. Drives the E27 ordering fence. */
  eventAt: Date | null;
  razorpaySubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  charge: SubscriptionChargeEntity | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asMinor(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/** Razorpay stamps epoch **seconds**; anything unparseable yields null. */
export function epochSecondsToDate(value: unknown): Date | null {
  if (value == null) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Reads the subscription entity, the event time and (for `subscription.charged`)
 * the invoice payment out of one Razorpay webhook body. Tolerant by design: a
 * missing branch yields null rather than throwing, because the caller must still
 * be able to record the raw event.
 */
export function parseSubscriptionEvent(body: unknown): ParsedSubscriptionEvent {
  const root = asRecord(body);
  const payload = asRecord(root.payload);
  const subscriptionEntity = asRecord(asRecord(payload.subscription).entity);
  const paymentEntity = asRecord(asRecord(payload.payment).entity);
  const eventType = asText(root.event);

  const paymentId = asText(paymentEntity.id);
  const amountMinor = asMinor(paymentEntity.amount);
  const charge: SubscriptionChargeEntity | null =
    paymentId && amountMinor != null
      ? {
          razorpayPaymentId: paymentId,
          amountMinor: Math.max(0, amountMinor),
          currency: (asText(paymentEntity.currency) ?? "INR").toUpperCase(),
          method: asText(paymentEntity.method),
          status: asText(paymentEntity.status) ?? "captured",
          razorpayInvoiceId: asText(paymentEntity.invoice_id),
          feeMinor: asMinor(paymentEntity.fee),
          taxMinor: asMinor(paymentEntity.tax),
          capturedAt: epochSecondsToDate(paymentEntity.created_at),
        }
      : null;

  return {
    eventType,
    eventAt: epochSecondsToDate(root.created_at),
    razorpaySubscriptionId: asText(subscriptionEntity.id),
    currentPeriodEnd: epochSecondsToDate(subscriptionEntity.current_end),
    charge,
  };
}

/** JSON-safe form of a charge, for queue payloads that round-trip through JSONB. */
export function serializeCharge(charge: SubscriptionChargeEntity): Record<string, unknown> {
  return { ...charge, capturedAt: charge.capturedAt ? charge.capturedAt.toISOString() : null };
}

/** Inverse of {@link serializeCharge}; returns null for anything unusable. */
export function deserializeCharge(value: unknown): SubscriptionChargeEntity | null {
  const raw = asRecord(value);
  const id = asText(raw.razorpayPaymentId);
  const amountMinor = asMinor(raw.amountMinor);
  if (!id || amountMinor == null) return null;
  const capturedAtText = asText(raw.capturedAt);
  const capturedAt = capturedAtText ? new Date(capturedAtText) : null;
  return {
    razorpayPaymentId: id,
    amountMinor: Math.max(0, amountMinor),
    currency: (asText(raw.currency) ?? "INR").toUpperCase(),
    method: asText(raw.method),
    status: asText(raw.status) ?? "captured",
    razorpayInvoiceId: asText(raw.razorpayInvoiceId),
    feeMinor: asMinor(raw.feeMinor),
    taxMinor: asMinor(raw.taxMinor),
    capturedAt: capturedAt && Number.isFinite(capturedAt.getTime()) ? capturedAt : null,
  };
}

/**
 * Records the full raw payload in `payments.events` (plan G15 — a processing
 * bug must be replayable). Additive: the caller's own ledger still decides
 * whether the event is processed.
 */
export async function mirrorSubscriptionEvent(input: {
  eventId: string;
  body: Record<string, unknown>;
  parsed?: ParsedSubscriptionEvent;
  livemode?: boolean;
}): Promise<{ isNew: boolean }> {
  const parsed = input.parsed ?? parseSubscriptionEvent(input.body);
  return recordEvent({
    eventId: input.eventId,
    eventType: parsed.eventType,
    entityId: parsed.razorpaySubscriptionId ?? parsed.charge?.razorpayPaymentId ?? null,
    payload: input.body,
    livemode: input.livemode ?? isLivemode(),
  });
}

/**
 * Closes out the mirrored event.
 *
 * Subscription events are applied by their own rail, never by the Rail-A
 * `payments.events` drain (which only understands order/payment shapes), so
 * they must not be left `pending` — the drain would claim them, find no
 * handler and burn attempts. Every mirrored subscription event therefore ends
 * in a terminal state here.
 */
export async function settleSubscriptionEvent(
  eventId: string,
  status: "processed" | "ignored" | "orphaned" | "failed",
  options: { error?: string | null; retryInSeconds?: number } = {},
): Promise<void> {
  await setEventStatus(eventId, status, options).catch(() => undefined);
}

export type RecordSubscriptionChargeInput = {
  rail: SubscriptionRail;
  charge: SubscriptionChargeEntity;
  razorpaySubscriptionId: string | null;
  /** Null when the charge cannot yet be attributed (webhook before checkout). */
  userId: string | null;
  livemode?: boolean;
  raw: Record<string, unknown>;
  /** Receipt copy; omitted fields fall back to generic wording. */
  receipt?: {
    subject?: string | null;
    productLabel?: string | null;
    href?: string | null;
    periodEnd?: Date | string | null;
  };
};

export type RecordSubscriptionChargeResult = {
  payment: PaymentRecord;
  /** Null when the charge could not be attributed to a student to mail. */
  receiptOutboxId: string | null;
};

function outboxIdForCharge(razorpayPaymentId: string): string {
  return `subscription_receipt_${razorpayPaymentId}`;
}

async function recipientFor(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<{ email: string | null; name: string | null }> {
  const res = await client.query<{ email: string | null; name: string | null }>(
    `SELECT email, name FROM origin_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const row = res.rows[0];
  return { email: row?.email?.trim() || null, name: row?.name?.trim() || null };
}

/**
 * Ledgers one recurring invoice charge and enqueues its receipt in the same
 * transaction.
 *
 * Idempotent on `razorpay_payment_id`: a re-delivered `subscription.charged`
 * upserts the same payment row and re-enqueues the same deterministic outbox
 * id, which `ON CONFLICT DO NOTHING` turns into a no-op. A student therefore
 * gets exactly one receipt per invoice no matter how often Razorpay retries.
 */
export async function recordSubscriptionCharge(
  input: RecordSubscriptionChargeInput,
): Promise<RecordSubscriptionChargeResult> {
  await ensurePaymentsSchema();
  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");

  const { charge } = input;
  const livemode = input.livemode ?? isLivemode();
  const outboxId = outboxIdForCharge(charge.razorpayPaymentId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const payment = await upsertPayment(
      {
        razorpayPaymentId: charge.razorpayPaymentId,
        // Rail B charges have no local Rail-A order; the subscription is the link.
        orderId: null,
        subscriptionId: input.razorpaySubscriptionId,
        razorpayInvoiceId: charge.razorpayInvoiceId,
        userId: input.userId,
        amountMinor: charge.amountMinor,
        currency: charge.currency,
        method: charge.method,
        status: charge.status,
        feeMinor: charge.feeMinor,
        taxMinor: charge.taxMinor,
        livemode,
        capturedAt: charge.capturedAt ?? new Date(),
        raw: input.raw,
      },
      client,
    );

    let receiptOutboxId: string | null = null;
    // Only a captured charge is receipt-worthy, and only when we know who paid.
    if (input.userId && charge.status === "captured") {
      const recipient = await recipientFor(client, input.userId);
      await enqueueOutbox(
        {
          id: outboxId,
          kind: "receipt_email",
          payload: {
            userId: input.userId,
            to: recipient.email,
            studentName: recipient.name,
            orderId: null,
            paymentId: charge.razorpayPaymentId,
            subscriptionId: input.razorpaySubscriptionId,
            rail: input.rail,
            amountMinor: charge.amountMinor,
            currency: charge.currency,
            kind: input.rail === "connect" ? "batch_subscription" : "subject_subscription",
            subject: input.receipt?.subject ?? null,
            termMonths: 1,
            paidAt: (charge.capturedAt ?? new Date()).toISOString(),
            expiresAt:
              input.receipt?.periodEnd instanceof Date
                ? input.receipt.periodEnd.toISOString()
                : (input.receipt?.periodEnd ?? null),
            href: input.receipt?.href ?? "/premium",
            ...(input.receipt?.productLabel
              ? { notificationTitle: "Payment received", notificationMessage: `Your payment for ${input.receipt.productLabel} was received. Your access is active.` }
              : {}),
          },
        },
        client,
      );
      receiptOutboxId = outboxId;
    }

    await client.query("COMMIT");
    if (receiptOutboxId) await publishOutbox(receiptOutboxId).catch(() => undefined);
    return { payment, receiptOutboxId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
