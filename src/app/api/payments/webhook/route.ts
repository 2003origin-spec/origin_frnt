/**
 * POST /api/payments/webhook — unified Rail-A Razorpay receiver.
 *
 * The raw body is authenticated before parsing. The full payload is inserted
 * into `payments.events` first; after that durable write, Razorpay gets `200`
 * even if inline application fails. The one-minute drain/reconcile path owns
 * the retry, so a slow database or a transient gateway issue cannot make
 * Razorpay redeliver an event that Origin already recorded.
 */

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { metric } from "@/lib/metrics";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getRazorpayMode,
  verifyRazorpayWebhookSignature,
} from "@/server/payments/razorpay-client";
import {
  getEvent,
  recordEvent,
  setEventStatus,
} from "@/server/payments/payments-store";
import { markEventSeen } from "@/server/payments/payments-redis";
import { processPaymentEvent } from "@/server/payments/orders-service";
import { eventDetails, isStale } from "@/server/payments/webhook-policy";

function eventIdFor(rawBody: string, header: string | null): string {
  const value = header?.trim();
  return value || `sha256:${crypto.createHash("sha256").update(rawBody, "utf8").digest("hex")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("payments")) {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    metric("origin.payments.webhook.bad_signature");
    return NextResponse.json({ detail: "Invalid signature." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = asRecord(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  const eventId = eventIdFor(rawBody, request.headers.get("x-razorpay-event-id"));
  const details = eventDetails(body);
  if (isStale(body)) {
    const recorded = await recordEvent({
      eventId,
      eventType: details.type,
      entityId: details.entityId,
      payload: body,
      livemode: getRazorpayMode() === "live",
    });
    if (recorded.isNew) await setEventStatus(eventId, "ignored", { error: "Event is older than seven days." });
    return NextResponse.json({ ok: true, recorded: recorded.isNew, ignored: true });
  }

  // Redis is only a fast duplicate path. A false result still reads the PG
  // ledger so an evicted/expired key can never cause a real event to be lost.
  // Redis is only a hint. In particular, a request can set Redis and then die
  // before the Postgres insert; a later delivery must still process when the
  // durable insert succeeds. The database ledger is the sole duplicate source.
  await markEventSeen(eventId);
  const recorded = await recordEvent({
    eventId,
    eventType: details.type,
    entityId: details.entityId,
    payload: body,
    livemode: getRazorpayMode() === "live",
  });
  if (!recorded.isNew) {
    const existing = await getEvent(eventId);
    return NextResponse.json({ ok: true, duplicate: true, status: existing?.status ?? "pending" });
  }

  try {
    const result = await processPaymentEvent({
      event: details.type,
      payload: body,
      livemode: getRazorpayMode() === "live",
    });
    await setEventStatus(eventId, result ? "processed" : "ignored");
    return NextResponse.json({ ok: true, recorded: true, processed: Boolean(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The raw event is durable. Leave it pending for the drain rather than
    // returning 500 and making Razorpay own a retry we can process ourselves.
    await setEventStatus(eventId, "failed", { error: message, retryInSeconds: 60 }).catch(() => undefined);
    metric("origin.payments.webhook.apply_failed", { event: details.type ?? "unknown" });
    return NextResponse.json({ ok: true, recorded: true, processed: false, pending: true });
  }
}
