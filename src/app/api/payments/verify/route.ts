/** POST /api/payments/verify — signed browser fast-path for a captured order. */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkRateLimit, paymentsVerifyLimiter } from "@/lib/rate-limit";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getOrderByRazorpayId } from "@/server/payments/payments-store";
import {
  applyPaymentSuccess,
} from "@/server/payments/orders-service";
import { verifyRazorpayPaymentSignature } from "@/server/payments/razorpay-client";

const VerifySchema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(120),
  razorpayPaymentId: z.string().trim().min(1).max(120),
  razorpaySignature: z.string().trim().min(1).max(256),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["student"]);
    const limited = await checkRateLimit(paymentsVerifyLimiter, `user:${ctx.userId}`);
    if (limited) return limited;

    if (parseAppVersionFromUserAgent(request.headers.get("user-agent")) !== null) {
      return teacherJson(
        { detail: "Razorpay purchases are unavailable inside the Origin app." },
        { status: 403 },
      );
    }

    const parsed = VerifySchema.safeParse(await parseJsonBody(request).catch(() => null));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });

    if (!verifyRazorpayPaymentSignature({
      razorpayOrderId: parsed.data.razorpayOrderId,
      razorpayPaymentId: parsed.data.razorpayPaymentId,
      signature: parsed.data.razorpaySignature,
    })) {
      return teacherJson({ detail: "Invalid payment signature." }, { status: 400 });
    }

    const order = await getOrderByRazorpayId(parsed.data.razorpayOrderId);
    if (!order || order.userId !== ctx.userId) {
      return teacherJson({ detail: "Payment order not found." }, { status: 404 });
    }

    const result = await applyPaymentSuccess({
      orderId: order.id,
      razorpayOrderId: parsed.data.razorpayOrderId,
      razorpayPaymentId: parsed.data.razorpayPaymentId,
    });
    return teacherJson({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}
