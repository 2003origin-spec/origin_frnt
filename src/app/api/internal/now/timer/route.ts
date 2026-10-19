/**
 * POST /api/internal/now/timer — one Origin NOW timer (offer expiry, dispatch
 * retry, no-show, session warning, session end), delivered by QStash with a
 * delay (src/server/now/now-realtime.ts scheduleNowTimer).
 *
 * Same auth as /api/internal/payments/dispatch: the forwarded internal bearer
 * is always required; the QStash signature too once signing keys are set.
 * Every handler re-reads the database and no-ops when the timer is stale, and
 * the one-minute /api/internal/now/sweep does the same work if a timer never
 * arrives. No-op while the `originNow` flag is off.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { handleTeacherError } from "@/app/api/teacher/_utils";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireInternal } from "@/server/authz";
import { NowError } from "@/server/now/now-http";
import { handleNowTimer } from "@/server/now/session-service";
import { isQStashSignatureVerificationConfigured, verifyQStashSignature } from "@/server/payments/qstash";

const TimerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer_expired"), offerId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("dispatch"), requestId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("no_show"), sessionId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("session_warn"), sessionId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("session_end"), sessionId: z.string().min(1).max(80), endsAt: z.string().max(40) }),
]);

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    const rawBody = await request.text();
    if (isQStashSignatureVerificationConfigured() && !(await verifyQStashSignature(request, rawBody))) {
      return NextResponse.json({ detail: "Invalid QStash signature." }, { status: 401 });
    }
    if (!isFeatureEnabled("originNow")) return NextResponse.json({ ok: true, skipped: "originNow flag off" });
    let body: unknown;
    try {
      body = rawBody.trim() ? JSON.parse(rawBody) : null;
    } catch {
      return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = TimerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ detail: parsed.error.message }, { status: 400 });
    try {
      const result = await handleNowTimer(parsed.data);
      return NextResponse.json({ ok: true, result });
    } catch (error) {
      // A domain error (row gone, state moved on) means the timer is stale:
      // acknowledge so QStash does not retry. Anything else is retryable.
      if (error instanceof NowError) return NextResponse.json({ ok: true, result: "stale", code: error.code });
      const detail = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ detail, retryable: true }, { status: 500 });
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
