/** POST /api/admin/payments/refund — initiate an audited Razorpay refund. */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { normalizeIdempotencyKey, withIdempotency } from "@/server/payments/idempotency";
import { initiateRefund, PaymentLifecycleError } from "@/server/payments/refunds-service";
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

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = RefundSchema.safeParse(await parseJsonBody(request));
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
