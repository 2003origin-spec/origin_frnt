/**
 * GET /api/admin/payments/summary — the numbers behind /admin/financials.
 *
 * Revenue by IST day, subject, method and order kind; MRR; refund rate; coupon
 * attribution; the checkout funnel; and the same health/backlog report the
 * internal probe returns. Everything is scoped to one Razorpay mode, defaulting
 * to the mode this deployment is actually running in (D16 — test money is never
 * mixed into live revenue).
 *
 * Deliberately NOT gated on the `payments` feature flag. The flag is a kill
 * switch for the student-facing checkout; blacking out the admin's revenue
 * screen the moment they pull that switch is precisely backwards. This matches
 * `/api/internal/payments/health`, which reports the flag rather than obeying it.
 *
 * Auth: admin session (enforced here and by the /api/admin route policy).
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §8 Phase 8.
 */

import type { NextRequest } from "next/server";

import { requireRole } from "@/server/authz";
import { getPaymentsSummary, resolveRange } from "@/server/payments/financials";
import { buildPaymentsHealth } from "@/server/payments/health-report";
import { isLivemode } from "@/server/payments/razorpay-client";
import { isUserPostgresConfigured } from "@/server/user-postgres";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export const dynamic = "force-dynamic";

/** `?livemode=` — explicit `0`/`1`/`true`/`false`, else this deployment's mode. */
function resolveLivemode(raw: string | null): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "live") return true;
  if (value === "0" || value === "false" || value === "test") return false;
  return isLivemode();
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    const params = request.nextUrl.searchParams;
    const livemode = resolveLivemode(params.get("livemode"));

    let range;
    try {
      range = resolveRange({
        from: params.get("from"),
        to: params.get("to"),
        days: params.get("days") ? Number(params.get("days")) : null,
      });
    } catch (error) {
      return teacherJson(
        { detail: error instanceof Error ? error.message : "Invalid reporting window." },
        { status: 400 },
      );
    }

    const health = await buildPaymentsHealth();
    if (!isUserPostgresConfigured()) {
      // No ledger to read. Returning the health block alone lets the dashboard
      // render its diagnosis ("USER_DATABASE_URL is not configured") instead of
      // showing an unexplained error toast.
      return teacherJson({ livemode, range, summary: null, health }, { status: 200 });
    }

    const summary = await getPaymentsSummary({ livemode, range });
    return teacherJson({ livemode, range, summary, health }, { status: 200 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
