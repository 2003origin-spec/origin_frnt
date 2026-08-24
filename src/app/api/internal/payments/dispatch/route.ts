/**
 * POST /api/internal/payments/dispatch — execute one payment-outbox row.
 *
 * QStash forwards the internal bearer token and signs the raw body. The
 * bearer check is always required; when signing keys are configured, the
 * QStash signature is required as well. With QStash unset, a manually invoked
 * internal request remains useful for operations and tests.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireInternal } from "@/server/authz";
import { handleTeacherError } from "@/app/api/teacher/_utils";
import { dispatchOutbox } from "@/server/payments/outbox";
import {
  isQStashSignatureVerificationConfigured,
  verifyQStashSignature,
} from "@/server/payments/qstash";

const DispatchSchema = z.object({
  outboxId: z.string().trim().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);

    const rawBody = await request.text();
    if (isQStashSignatureVerificationConfigured()) {
      const valid = await verifyQStashSignature(request, rawBody);
      if (!valid) {
        return NextResponse.json({ detail: "Invalid QStash signature." }, { status: 401 });
      }
    }

    let body: unknown;
    try {
      body = rawBody.trim() ? JSON.parse(rawBody) : null;
    } catch {
      return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = DispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ detail: parsed.error.message }, { status: 400 });
    }

    try {
      const result = await dispatchOutbox(parsed.data.outboxId, "qstash");
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      // A non-2xx response is intentional here: QStash should retry delivery
      // after the outbox row has been returned to its retryable state.
      const detail = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ detail, retryable: true }, { status: 500 });
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
