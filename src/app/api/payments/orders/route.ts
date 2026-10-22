/**
 * GET /api/payments/orders — the authenticated student's order history.
 * GET /api/payments/orders?orderId=<id> — one order's status, owner-scoped,
 * polled by the checkout while a captured payment is being activated.
 *
 * The single-order read is a query parameter on this existing route rather
 * than a new `orders/[orderId]` route file (the repo's Next 16 new-route-404
 * rule).
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkRateLimit, paymentsVerifyLimiter } from "@/lib/rate-limit";
import { requireRole } from "@/server/authz";
import { teacherJson } from "@/app/api/teacher/_utils";
import { getOrderById, listUserOrders } from "@/server/payments/payments-store";

import { paymentsErrorResponse } from "../_errors";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["student"]);
    const params = new URL(request.url).searchParams;

    const orderId = params.get("orderId")?.trim();
    if (orderId) {
      const limited = await checkRateLimit(paymentsVerifyLimiter, `order-status:${ctx.userId}`);
      if (limited) return limited;
      const order = orderId.length <= 120 ? await getOrderById(orderId) : null;
      // Another student's order is indistinguishable from a missing one.
      if (!order || order.userId !== ctx.userId) {
        return teacherJson({ detail: "Payment order not found." }, { status: 404, headers: NO_STORE });
      }
      return teacherJson(
        { orderId: order.id, status: order.status, paidAt: order.paidAt },
        { headers: NO_STORE },
      );
    }

    const rawLimit = Number(params.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50;
    return teacherJson({ orders: await listUserOrders(ctx.userId, limit) });
  } catch (error) {
    return paymentsErrorResponse(error);
  }
}
