/**
 * Per-subject premium subscription service (Phase 1.2).
 *
 * Orchestrates Razorpay Subscriptions + the subscriptions.* store + the derived
 * premium-flag recompute. Entitlement is granted ONLY by the webhook — the
 * client success handler never unlocks anything.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import { getRazorpayClient, getRazorpayKeyId } from "@/server/payments/razorpay-client";
import { SUBJECT_BILLING_CYCLES } from "@/server/payments/subject-plans";
import { getSubjectPriceResolved, getOrCreateMonthlyPlan } from "@/server/pricing/pricing-service";
import {
  commitCouponReservation,
  rebindCouponReservation,
  releaseCouponReservation,
  reserveCoupon,
  validateCoupon,
} from "@/server/pricing/coupons-service";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { type Subject } from "@/lib/entitlements";
import { createPrefixedId } from "@/server/workspaces/ids";

import {
  mirrorSubscriptionEvent,
  parseSubscriptionEvent,
  recordSubscriptionCharge,
  settleSubscriptionEvent,
} from "@/server/payments/subscription-ledger";
import { isLivemode } from "@/server/payments/razorpay-client";

import {
  applyWebhookTransition,
  deleteWebhookEvent,
  getSubscriptionBySubject,
  listUserSubscriptions,
  recordWebhookEvent,
  upsertCreatedSubscription,
  type SubjectSubscription,
  type SubscriptionStatus,
} from "./subscriptions-store";

export type CreateSubscriptionResult = {
  subscriptionId: string;
  razorpayKeyId: string;
  shortUrl: string | null;
};

/**
 * Creates a Razorpay subscription for one subject and records a `created` row.
 * Returns the data the browser checkout needs. No entitlement is granted yet.
 */
export async function createSubjectSubscription(input: {
  userId: string;
  subject: Subject;
  couponCode?: string | null;
}): Promise<CreateSubscriptionResult> {
  const { userId, subject } = input;
  // Resolve the admin-set price + plan (falls back to the legacy ₹499 + env plan
  // when no override exists — identical to the pre-pricing behaviour).
  const resolved = await getSubjectPriceResolved(subject);
  // The stored plan id is a cache, not a prerequisite: an admin may have set the
  // price while Razorpay was unconfigured (Rail A does not need a plan). Resolve
  // one lazily here, through the shape cache, so enabling Rail B later works
  // without re-saving every price.
  let planId =
    resolved.razorpayPlanId ??
    (await getOrCreateMonthlyPlan({
      kind: "subject",
      subject,
      amountMinor: resolved.amountMinor,
      name: `Origin Premium — ${subject} (₹${(resolved.amountMinor / 100).toFixed(0)}/mo)`,
      notes: { origin_kind: "subject_price", origin_subject: subject },
    }));
  let amountMinor = resolved.amountMinor;
  let couponReservation: { code: string; userId: string } | null = null;
  let couponIntentId: string | null = null;

  // Coupon (platform subscriptions only). A valid coupon resolves to a reusable
  // plan shape; it never mints a new Razorpay plan per student. Reservation is
  // committed only after the local subscription row is durable.
  if (input.couponCode && isFeatureEnabled("adminCoupons")) {
    const v = await validateCoupon({
      code: input.couponCode,
      userId,
      target: { kind: "subject", subject, baseAmountMinor: resolved.amountMinor },
    });
    if (!v.valid) {
      const err = new Error(v.reason);
      (err as { status?: number }).status = 400;
      throw err;
    }
    if (v.discountMinor > 0 && v.finalMinor <= 0) {
      const err = new Error("A fully discounted purchase must use prepaid checkout.");
      (err as { status?: number }).status = 400;
      throw err;
    }
    amountMinor = v.finalMinor;
    // Reserve before contacting Razorpay. The local intent id satisfies the
    // redemption unique key; it is rebound to the gateway id after creation.
    couponIntentId = createPrefixedId("subintent");
    try {
      const reservation = await reserveCoupon({
        code: v.code,
        userId,
        subject,
        targetKind: "subject",
        subscriptionId: couponIntentId,
        amountDiscountedMinor: v.discountMinor,
      });
      couponReservation = { code: reservation.code, userId: reservation.userId };
      if (v.discountMinor > 0) {
        planId = await getOrCreateMonthlyPlan({
          kind: "subject",
          subject,
          amountMinor: v.finalMinor,
          name: `Origin Premium — ${subject} (discounted)`,
          notes: { origin_kind: "subject_coupon", origin_subject: subject, origin_coupon: v.code },
        });
      }
    } catch (error) {
      if (couponReservation) {
        await releaseCouponReservation({
          code: couponReservation.code,
          userId: couponReservation.userId,
          subscriptionId: couponIntentId,
        }).catch(() => undefined);
      }
      throw error;
    }
  }

  let client: ReturnType<typeof getRazorpayClient>;
  let subscription: { id: string; short_url?: string | null };
  try {
    client = getRazorpayClient();
    subscription = await client.subscriptions.create({
      plan_id: planId,
      total_count: SUBJECT_BILLING_CYCLES,
      customer_notify: 1,
      notes: { origin_user_id: userId, origin_subject: subject },
    });
  } catch (error) {
    if (couponReservation && couponIntentId) {
      await releaseCouponReservation({
        code: couponReservation.code,
        userId: couponReservation.userId,
        subscriptionId: couponIntentId,
      }).catch(() => undefined);
    }
    throw error;
  }

  if (couponReservation && couponIntentId) {
    try {
      const rebound = await rebindCouponReservation({
        code: couponReservation.code,
        userId: couponReservation.userId,
        fromSubscriptionId: couponIntentId,
        toSubscriptionId: subscription.id,
      });
      if (!rebound) throw new Error("Coupon reservation could not be attached to the subscription");
    } catch (error) {
      // Do not leave a live subscription without its coupon reservation. Best
      // effort cancellation is safer than silently consuming/overselling a code.
      await client.subscriptions.cancel(subscription.id, true).catch(() => undefined);
      await releaseCouponReservation({
        code: couponReservation.code,
        userId: couponReservation.userId,
        subscriptionId: couponIntentId,
      }).catch(() => undefined);
      throw error;
    }
  }

  try {
    await upsertCreatedSubscription({
      userId,
      subject,
      razorpayPlanId: planId,
      razorpaySubscriptionId: subscription.id,
      shortUrl: subscription.short_url ?? null,
      amountMinor,
    });
    if (couponReservation) {
      const committed = await commitCouponReservation({
        code: couponReservation.code,
        userId: couponReservation.userId,
        subscriptionId: subscription.id,
      });
      if (!committed) throw new Error("Coupon reservation could not be committed");
    }
  } catch (error) {
    if (couponReservation) {
      await releaseCouponReservation({
        code: couponReservation.code,
        userId: couponReservation.userId,
        subscriptionId: subscription.id,
      }).catch(() => undefined);
    }
    await client.subscriptions.cancel(subscription.id, true).catch(() => undefined);
    throw error;
  }

  return {
    subscriptionId: subscription.id,
    razorpayKeyId: getRazorpayKeyId(),
    shortUrl: subscription.short_url ?? null,
  };
}

/**
 * Cancels a subject subscription at the end of the current cycle, so the
 * student keeps access until current_period_end. The actual status flip is
 * applied by the resulting `subscription.cancelled` webhook.
 */
export async function cancelSubjectSubscription(input: {
  userId: string;
  subject: Subject;
}): Promise<SubjectSubscription> {
  const existing = await getSubscriptionBySubject(input.userId, input.subject);
  if (!existing || !existing.razorpaySubscriptionId) {
    const err = new Error("No active subscription found for this subject.");
    (err as { status?: number }).status = 404;
    throw err;
  }
  const client = getRazorpayClient();
  await client.subscriptions.cancel(existing.razorpaySubscriptionId, true);
  return existing;
}

export async function listMySubscriptions(userId: string): Promise<SubjectSubscription[]> {
  return listUserSubscriptions(userId);
}

// ─── Webhook handling ─────────────────────────────────────────────────────────

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        current_end?: number | null;
      };
    };
  };
};

/**
 * Maps a Razorpay subscription event to the local status. `activated` and
 * `charged` both ensure `active` (Razorpay may deliver them out of order, so we
 * never assume sequence). `halted`/`pending`/`cancelled`/`completed` keep the
 * existing period end so entitlement persists until it lapses.
 */
function statusForEvent(event: string): SubscriptionStatus | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "active";
    case "subscription.authenticated":
      return "authenticated";
    case "subscription.pending":
      return "pending";
    case "subscription.halted":
      return "halted";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.completed":
      return "completed";
    case "subscription.expired":
      return "expired";
    default:
      return null;
  }
}

export type WebhookProcessResult =
  | { processed: false; reason: "duplicate" | "ignored" | "unknown_subscription" | "stale" }
  | {
      processed: true;
      userId: string;
      subject: Subject;
      status: SubscriptionStatus;
      /** Set when the event was `subscription.charged` and a payment was ledgered. */
      chargeLedgered?: boolean;
    };

/**
 * Processes a verified Razorpay subscription webhook.
 *
 * Phase 6 additions, all additive:
 *  - the RAW payload is mirrored into `payments.events` before anything else,
 *    so any event on this rail is replayable (plan G15);
 *  - `subscription.charged` also writes the invoice charge into
 *    `payments.payments` and enqueues one receipt (plan Phase 6);
 *  - the status transition is fenced on the Razorpay event time (plan E27).
 *
 * `subscriptions.webhook_events` remains the idempotency authority for this
 * rail, so an event that is in flight across the deploy behaves exactly as it
 * did before.
 */
export async function processSubscriptionWebhook(
  eventId: string,
  body: RazorpayWebhookEvent,
): Promise<WebhookProcessResult> {
  const eventType = body.event ?? null;
  const parsed = parseSubscriptionEvent(body);
  const livemode = isLivemode();

  // Durable raw-event mirror FIRST. If this throws, nothing has been recorded
  // anywhere and Razorpay's retry is the correct outcome.
  const mirrored = await mirrorSubscriptionEvent({
    eventId,
    body: body as Record<string, unknown>,
    parsed,
    livemode,
  });

  // Idempotency: a re-delivered event id is acknowledged without reprocessing.
  const isNew = await recordWebhookEvent(eventId, eventType);
  if (!isNew) {
    if (mirrored.isNew) await settleSubscriptionEvent(eventId, "ignored", { error: "Duplicate of an event already processed by the subscriptions ledger." });
    return { processed: false, reason: "duplicate" };
  }

  // From here the event is recorded; if anything below throws we must remove the
  // ledger entry so Razorpay's retry reprocesses instead of skipping forever.
  try {
    const status = eventType ? statusForEvent(eventType) : null;
    const razorpaySubscriptionId = parsed.razorpaySubscriptionId;
    if (!eventType || !status || !razorpaySubscriptionId) {
      await settleSubscriptionEvent(eventId, "ignored");
      return { processed: false, reason: "ignored" };
    }

    // Only "active" transitions move the billing period forward; lapse states
    // keep the current period end so access persists to its natural expiry.
    const currentPeriodEnd = status === "active" ? parsed.currentPeriodEnd : null;

    const transition = await applyWebhookTransition({
      razorpaySubscriptionId,
      status,
      currentPeriodEnd,
      eventAt: parsed.eventAt,
    });

    if (transition.outcome === "unknown") {
      // The money still happened even though we cannot attribute it yet — a
      // checkout that has not committed, or a subscription created elsewhere.
      // Ledger the charge unattributed rather than discarding it.
      if (parsed.charge) {
        await recordSubscriptionCharge({
          rail: "platform",
          charge: parsed.charge,
          razorpaySubscriptionId,
          userId: null,
          livemode,
          raw: body as Record<string, unknown>,
        });
      }
      await settleSubscriptionEvent(eventId, "orphaned", {
        error: `No local subscription for ${razorpaySubscriptionId}`,
      });
      return { processed: false, reason: "unknown_subscription" };
    }

    const subscription = transition.subscription;

    // A charge is money and is ledgered even when the transition itself was
    // dropped as stale — the invoice was still paid.
    let chargeLedgered = false;
    if (parsed.charge && eventType === "subscription.charged") {
      await recordSubscriptionCharge({
        rail: "platform",
        charge: parsed.charge,
        razorpaySubscriptionId,
        userId: subscription.userId,
        livemode,
        raw: body as Record<string, unknown>,
        receipt: {
          subject: subscription.subject,
          productLabel: `${subscription.subject} Premium`,
          href: "/premium",
          periodEnd: subscription.currentPeriodEnd,
        },
      });
      chargeLedgered = true;
    }

    if (transition.outcome === "stale") {
      await settleSubscriptionEvent(eventId, "ignored", {
        error: "Superseded by a newer subscription event.",
      });
      return { processed: false, reason: "stale" };
    }

    await recomputeUserPremiumFlags(subscription.userId);
    await settleSubscriptionEvent(eventId, "processed");

    return {
      processed: true,
      userId: subscription.userId,
      subject: subscription.subject,
      status,
      chargeLedgered,
    };
  } catch (error) {
    await deleteWebhookEvent(eventId).catch(() => undefined);
    await settleSubscriptionEvent(eventId, "failed", {
      error: error instanceof Error ? error.message : String(error),
      retryInSeconds: 60,
    });
    throw error;
  }
}
