/**
 * The retry half of the webhook contract.
 *
 * `/api/payments/webhook` verifies the HMAC, writes the raw payload to
 * `payments.events`, and returns `200` **even when inline application fails** —
 * deliberately, so Razorpay does not own a retry Origin can perform itself
 * against a payload it already holds. Its own comment says "leave it pending for
 * the drain". That drain is this module.
 *
 * Without it a `pending`/`failed` event is never touched again: E25 (webhook
 * arrives before the order row commits) and E30 (cold start, transient database
 * error) would be healed only by the 15-minute reconcile asking Razorpay for the
 * order's state, and the stored event would sit in the backlog forever, which is
 * also what makes `/api/internal/payments/health` and /admin/financials read
 * `failedEvents > 0` permanently.
 *
 * `claimDueEvents` already does the hard part — `FOR UPDATE SKIP LOCKED`, an
 * attempt burned at claim time, a 5-minute lease, and the `subscription.*`
 * exclusion. This adds only the execute-and-mark loop around it.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §6 (the drain drains events + outbox),
 * edge cases E25, E29, E30, E39. Phase 9.
 */

import {
  claimDueEvents,
  setEventStatus,
  MAX_EVENT_ATTEMPTS,
  type PaymentEvent,
} from "./payments-store";

/**
 * The apply step is reached through a lazy import rather than a top-level one.
 * `orders-service` pulls in the pricing layer, which is marked `server-only`, so
 * a static import would drag that whole graph into anything that touches this
 * module — including the non-react-server test runner, which cannot load it at
 * all. Resolving it at call time also keeps it off the cron's cold-start path
 * for a tick that claims nothing.
 */
type ProcessEvent = typeof import("./orders-service").processPaymentEvent;

const defaultProcess: ProcessEvent = async (input) => {
  const { processPaymentEvent } = await import("./orders-service");
  return processPaymentEvent(input);
};

export type EventsDrainResult = {
  claimed: number;
  processed: number;
  /** Applied to nothing — a known event type with no work left to do. */
  ignored: number;
  /** Failed this pass and will be retried. */
  retrying: number;
  /** Failed at MAX_EVENT_ATTEMPTS and parked for a human. */
  parked: number;
};

/** 1m, 2m, 4m, 8m, 16m, capped at 30m — the same shape the outbox uses. */
export function eventRetryDelaySeconds(attempts: number): number {
  return Math.min(30 * 60, 60 * 2 ** Math.max(0, Math.min(attempts - 1, 5)));
}

type Deps = {
  claim?: typeof claimDueEvents;
  process?: ProcessEvent;
  mark?: typeof setEventStatus;
};

/** Executes one claimed event and records its outcome. */
async function runOne(event: PaymentEvent, deps: Required<Deps>): Promise<keyof Omit<EventsDrainResult, "claimed">> {
  try {
    const result = await deps.process({
      event: event.eventType ?? "",
      payload: event.payload,
      livemode: event.livemode,
    });
    await deps.mark(event.eventId, result ? "processed" : "ignored");
    return result ? "processed" : "ignored";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // `attempts` was already incremented by the claim, so this comparison is
    // against the count *including* the attempt that just failed.
    const parked = event.attempts >= MAX_EVENT_ATTEMPTS;
    await deps.mark(event.eventId, "failed", {
      error: message,
      // A parked row keeps a long delay rather than a zero one so that raising
      // MAX_EVENT_ATTEMPTS after an incident does not stampede every parked
      // event into the very next drain tick.
      retryInSeconds: eventRetryDelaySeconds(event.attempts),
    });
    return parked ? "parked" : "retrying";
  }
}

/**
 * Drains one bounded batch of due webhook events.
 *
 * Never throws for a single bad event: one poisoned payload must not stop the
 * rest of the batch, and the cron re-enters every minute regardless.
 */
export async function drainPaymentEvents(limit = 25, deps: Deps = {}): Promise<EventsDrainResult> {
  const resolved: Required<Deps> = {
    claim: deps.claim ?? claimDueEvents,
    process: deps.process ?? defaultProcess,
    mark: deps.mark ?? setEventStatus,
  };
  const claimed = await resolved.claim(Math.min(Math.max(limit, 1), 100));
  const result: EventsDrainResult = {
    claimed: claimed.length,
    processed: 0,
    ignored: 0,
    retrying: 0,
    parked: 0,
  };
  for (const event of claimed) {
    result[await runOne(event, resolved)] += 1;
  }
  return result;
}
