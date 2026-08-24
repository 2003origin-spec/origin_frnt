/**
 * POST /api/payments/checkout — create a prepaid Rail-A order.
 *
 * The browser supplies only the product choice. Amounts are resolved by the
 * server, and the durable idempotency wrapper is applied before Razorpay is
 * contacted. The payments feature flag is intentionally independent from the
 * legacy subscriptions rail.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { isFeatureEnabled, requireFeatureEnabled } from "@/lib/feature-flags";
import {
  checkRateLimit,
  paymentsCheckoutIpLimiter,
  paymentsCheckoutLimiter,
} from "@/lib/rate-limit";
import { parseJsonBody } from "@/server/http";
import { parseAppVersionFromUserAgent } from "@/native/is-native-app";
import { requireRole } from "@/server/authz";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import {
  createCheckoutOrder,
  type CreateCheckoutOrderInput,
} from "@/server/payments/orders-service";
import {
  normalizeIdempotencyKey,
  withIdempotency,
} from "@/server/payments/idempotency";

const CheckoutSchema = z
  .object({
    kind: z.enum(["subject_term", "bundle_term", "institute_offering"]).default("subject_term"),
    subject: z.string().trim().min(1).max(32).optional(),
    bundleId: z.string().trim().min(1).max(120).optional(),
    // institute_offering only (plan G16). Amount still comes from the offering
    // row on the server; the browser only names which offering it wants.
    workspaceId: z.string().trim().min(1).max(120).optional(),
    offeringId: z.string().trim().min(1).max(120).optional(),
    termMonths: z.number().int().positive().max(120),
    couponCode: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (value) =>
      value.kind !== "institute_offering" || Boolean(value.workspaceId && value.offeringId),
    { message: "workspaceId and offeringId are required for an institute offering." },
  );

function callerIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

function responseFor(result: Awaited<ReturnType<typeof createCheckoutOrder>>) {
  return {
    orderId: result.orderId,
    razorpayOrderId: result.razorpayOrderId,
    amountMinor: result.amountMinor,
    currency: result.currency,
    keyId: result.keyId,
    status: result.order.status,
    order: result.order,
  };
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["student"]);

    if (parseAppVersionFromUserAgent(request.headers.get("user-agent")) !== null) {
      return teacherJson(
        { detail: "Razorpay purchases are unavailable inside the Origin app." },
        { status: 403 },
      );
    }

    const userLimited = await checkRateLimit(paymentsCheckoutLimiter, `user:${ctx.userId}`);
    if (userLimited) return userLimited;
    const ipLimited = await checkRateLimit(paymentsCheckoutIpLimiter, `ip:${callerIp(request)}`);
    if (ipLimited) return ipLimited;

    const rawBody = await parseJsonBody(request).catch(() => null);
    const parsed = CheckoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    if (parsed.data.couponCode && !isFeatureEnabled("adminCoupons")) {
      requireFeatureEnabled("adminCoupons");
    }

    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("idempotency-key"));
    if (!idempotencyKey) {
      return teacherJson(
        { detail: "Idempotency-Key header is required for checkout." },
        { status: 400 },
      );
    }

    const input: CreateCheckoutOrderInput = {
      userId: ctx.userId,
      kind: parsed.data.kind,
      subject: parsed.data.subject ?? "",
      bundleId: parsed.data.bundleId ?? null,
      workspaceId: parsed.data.workspaceId ?? null,
      offeringId: parsed.data.offeringId ?? null,
      termMonths: parsed.data.termMonths,
      couponCode: parsed.data.couponCode ?? null,
      idempotencyKey,
    };
    const outcome = await withIdempotency({
      userId: ctx.userId,
      key: idempotencyKey,
      endpoint: "/api/payments/checkout",
      body: parsed.data,
      fn: async () => responseFor(await createCheckoutOrder(input)),
    });

    return teacherJson(outcome.result, { status: outcome.replayed ? 200 : 201 });
  } catch (error) {
    // Razorpay outages must be retryable rather than presented as a validation
    // error. The service tags gateway failures where possible; preserve the
    // normal route error adapter for auth/flag/idempotency failures.
    const status = error instanceof Error ? (error as { status?: number }).status : undefined;
    if (status === 503) {
      return teacherJson(
        { detail: error instanceof Error ? error.message : "Payment gateway unavailable." },
        { status: 503, headers: { "Retry-After": "10" } },
      );
    }
    return handleTeacherError(error);
  }
}
