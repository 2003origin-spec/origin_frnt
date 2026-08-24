/**
 * POST /api/subscriptions                       — create a subject subscription
 * POST /api/subscriptions?action=create_subscription {subject}
 * POST /api/subscriptions?action=cancel {subject} — cancel at cycle end
 * GET  /api/subscriptions                        — list caller's subscriptions
 *
 * Student-only (enforced here + by the authenticated route policy). Gated by
 * the premiumSubscriptions feature flag so the whole surface ships dark. CSRF
 * is enforced at the edge by middleware. Entitlement is granted only by the
 * webhook — this route never unlocks anything.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { ALL_SUBJECTS } from "@/lib/entitlements";
import {
  cancelSubjectSubscription,
  createSubjectSubscription,
  listMySubscriptions,
} from "@/server/subscriptions/subscriptions-service";
import { getPublicPricing, getSubjectPriceResolved } from "@/server/pricing/pricing-service";
import { validateCoupon } from "@/server/pricing/coupons-service";
import { isSubscriptionsRailEnabled } from "@/server/payments/razorpay-client";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SubjectSchema = z.object({
  subject: z.enum(ALL_SUBJECTS as [string, ...string[]]),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("premiumSubscriptions");
    const ctx = await requireRole(request, ["student"]);
    const action = new URL(request.url).searchParams.get("action");
    const body = await parseJsonBody(request);
    const parsed = SubjectSchema.safeParse(body);
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const subject = parsed.data.subject as (typeof ALL_SUBJECTS)[number];

    if (action === "cancel") {
      await cancelSubjectSubscription({ userId: ctx.userId, subject });
      return teacherJson({ ok: true });
    }

    if (action === "validate_coupon") {
      if (!parsed.data.couponCode) return teacherJson({ valid: false, reason: "Enter a coupon code." });
      const resolved = await getSubjectPriceResolved(subject);
      const result = await validateCoupon({
        code: parsed.data.couponCode,
        userId: ctx.userId,
        target: { kind: "subject", subject, baseAmountMinor: resolved.amountMinor },
      });
      return teacherJson(result);
    }

    // Default action: create_subscription. Rail B (recurring mandate) is dark
    // until Razorpay approves e-mandate on the account — plan D1/Q2. Cancel and
    // list stay open above so anyone who already holds a mandate can manage it.
    if (!isSubscriptionsRailEnabled()) {
      return teacherJson(
        {
          detail:
            "Auto-renewing subscriptions are not available yet. Choose a prepaid term instead.",
        },
        { status: 409 },
      );
    }
    const result = await createSubjectSubscription({ userId: ctx.userId, subject, couponCode: parsed.data.couponCode });
    return teacherJson(result, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("premiumSubscriptions");
    const ctx = await requireRole(request, ["student"]);
    const [subscriptions, pricing] = await Promise.all([
      listMySubscriptions(ctx.userId),
      getPublicPricing(),
    ]);
    // The browser needs to know whether to render a "Subscribe" control at all.
    return teacherJson({ subscriptions, pricing, subscriptionsEnabled: isSubscriptionsRailEnabled() });
  } catch (error) {
    return handleTeacherError(error);
  }
}
