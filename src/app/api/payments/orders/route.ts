/** GET /api/payments/orders — the authenticated student's order history. */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { listUserOrders } from "@/server/payments/payments-store";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("payments");
    const ctx = await requireRole(request, ["student"]);
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 50;
    return teacherJson({ orders: await listUserOrders(ctx.userId, limit) });
  } catch (error) {
    return handleTeacherError(error);
  }
}
