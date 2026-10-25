/**
 * /api/admin/payments/refund
 *
 * POST — initiate an audited Razorpay refund.
 * POST `{ action: "abandon_intent", razorpayPaymentId }` — admin escape for a
 *   refund attempt whose Razorpay outcome stayed unknown: re-checks Razorpay,
 *   records the refund if it did go out, and otherwise (only after the settle
 *   window) marks the attempt abandoned with an audit event.
 * GET — the open and abandoned refund attempts (refund intents).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { normalizeIdempotencyKey, withIdempotency } from "@/server/payments/idempotency";
import {
  abandonRefundIntent,
  initiateRefund,
  listRefundIntents,
  PaymentLifecycleError,
} from "@/server/payments/refunds-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const RefundSchema = z.object({
  razorpayPaymentId: z.string().trim().min(1).max(120).optional(),
  paymentId: z.string().trim().min(1).max(120).optional(),
  amountMinor: z.number().int().positive().optional().nullable(),
  amount: z.number().int().positive().optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
}).refine((value) => Boolean(value.razorpayPaymentId ?? value.paymentId), {
  message: "razorpayPaymentId is required.",
  path: ["razorpayPaymentId"],
});

const AbandonIntentSchema = z.object({
  action: z.literal("abandon_intent"),
  razorpayPaymentId: z.string().trim().min(1).max(120),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    await requireRole(request, ["admin"]);
    const limit = Number(request.nextUrl.searchParams.get("limit")) || undefined;
    return teacherJson({ intents: await listRefundIntents({ limit }) }, { status: 200 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["admin"]);
    const body = await parseJsonBody(request);
    if ((body as { action?: unknown } | null)?.action === "abandon_intent") {
      const abandon = AbandonIntentSchema.safeParse(body);
      if (!abandon.success) return teacherJson({ detail: abandon.error.message }, { status: 400 });
      const result = await abandonRefundIntent({
        razorpayPaymentId: abandon.data.razorpayPaymentId,
        actorUserId: ctx.userId,
        requestId: request.headers.get("x-request-id"),
        audit: recordAuditEvent,
      });
      return teacherJson(result, { status: 200 });
    }
    const parsed = RefundSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });

    const razorpayPaymentId = parsed.data.razorpayPaymentId ?? parsed.data.paymentId!;
    const amountMinor = parsed.data.amountMinor ?? parsed.data.amount ?? null;
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
    if (!idempotencyKey) {
      return teacherJson({ detail: "Idempotency-Key header is required for refunds." }, { status: 400 });
    }
    const outcome = await withIdempotency({
      userId: ctx.userId,
      key: idempotencyKey,
      endpoint: "/api/admin/payments/refund",
      body: { razorpayPaymentId, amountMinor, reason: parsed.data.reason ?? null },
      fn: async () => {
        // Audit the request before the irreversible gateway call. A gateway
        // failure therefore remains visible as an attempted admin action, and
        // a successful refund can never exist without an audit row.
        await recordAuditEvent({
          actorUserId: ctx.userId,
          workspaceId: null,
          entityType: "payment",
          entityId: razorpayPaymentId,
          action: "payment.refund_requested",
          after: { amountMinor, reason: parsed.data.reason ?? null },
          requestId: request.headers.get("x-request-id"),
        });
        return initiateRefund({
          razorpayPaymentId,
          amountMinor,
          reason: parsed.data.reason ?? null,
          initiatedBy: ctx.userId,
        });
      },
    });
    return teacherJson({ ...outcome.result, replayed: outcome.replayed }, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentLifecycleError) {
      return teacherJson({ detail: error.message }, { status: error.status });
    }
    return handleTeacherError(error);
  }
}
