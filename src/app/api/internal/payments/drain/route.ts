/**
 * GET | POST /api/internal/payments/drain — the minute-cron backstop.
 *
 * Drains BOTH halves of the retry contract (plan §6):
 *
 *   • `payments.events` — webhook payloads whose inline application failed. The
 *     webhook returns 200 the moment the raw event is durable and explicitly
 *     defers the retry here, so without this half a pending event was never
 *     retried at all (E25, E30).
 *   • `payments.outbox` — receipts and notifications. QStash is intentionally
 *     optional; this is what makes the system correct without it (E35).
 *
 * Both claim with Postgres row locks in a bounded batch, so the pass is
 * resumable if the function times out, and two overlapping crons are safe.
 *
 * Events are drained first: an event that is still pending has money attached
 * and may enqueue the very outbox row this same pass then delivers.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { handleTeacherError } from "@/app/api/teacher/_utils";
import { drainPaymentEvents } from "@/server/payments/events-drain";
import { drainOutbox } from "@/server/payments/outbox";

function limitFrom(request: NextRequest): number {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? "25");
  return Number.isFinite(raw) ? Math.trunc(raw) : 25;
}

async function drain(request: NextRequest) {
  try {
    await requireCronCaller(request);
    const limit = limitFrom(request);
    const events = await drainPaymentEvents(limit);
    const outbox = await drainOutbox(limit);
    // `...outbox` stays spread at the top level so the existing response shape
    // (claimed/done/failed/skipped) is unchanged for anything already reading it.
    return NextResponse.json({ ok: true, ...outbox, events, outbox });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  return drain(request);
}

export async function POST(request: NextRequest) {
  return drain(request);
}

