/** POST /api/payments/coupon/validate — preview a coupon without reserving it. */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import {
  checkRateLimit,
  paymentsCouponFailureLimiter,
  paymentsCouponLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { resolveOrderAmount } from "@/server/payments/orders-service";
import { validateCoupon } from "@/server/pricing/coupons-service";

const CouponValidationSchema = z.object({
  kind: z.enum(["subject_term", "bundle_term"]).default("subject_term"),
  subject: z.string().trim().min(1).max(32).optional(),
  bundleId: z.string().trim().min(1).max(120).optional(),
  termMonths: z.number().int().positive().max(120),
  couponCode: z.string().trim().min(1).max(80),
});

function callerIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    requireFeatureEnabled("adminCoupons");
    const ctx = await requireRole(request, ["student"]);

    const limited = await checkRateLimit(paymentsCouponLimiter, `user:${ctx.userId}`);
    if (limited) return limited;

    const parsed = CouponValidationSchema.safeParse(await parseJsonBody(request).catch(() => null));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }

    // Resolve the amount from the same authoritative pricing path as checkout,
    // deliberately omitting couponCode so this endpoint can never reserve one.
    const resolved = await resolveOrderAmount({
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      bundleId: parsed.data.bundleId,
      termMonths: parsed.data.termMonths,
      userId: ctx.userId,
    });
    const result = await validateCoupon({
      code: parsed.data.couponCode,
      userId: ctx.userId,
      target: {
        kind: resolved.kind === "bundle_term" ? "bundle" : "subject",
        subject: resolved.subject ?? undefined,
        baseAmountMinor: resolved.baseMinor,
      },
    });

    if (!result.valid) {
      const failureLimited = await checkRateLimit(
        paymentsCouponFailureLimiter,
        `user:${ctx.userId}:ip:${callerIp(request)}`,
      );
      if (failureLimited) return failureLimited;
      return teacherJson({
        valid: false,
        reason: result.reason,
        baseMinor: resolved.baseMinor,
        discountMinor: 0,
        amountMinor: resolved.baseMinor,
        finalMinor: resolved.baseMinor,
        currency: resolved.currency,
      });
    }

    return teacherJson({
      valid: true,
      code: result.code,
      baseMinor: resolved.baseMinor,
      discountMinor: result.discountMinor,
      amountMinor: result.finalMinor,
      finalMinor: result.finalMinor,
      currency: resolved.currency,
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}
