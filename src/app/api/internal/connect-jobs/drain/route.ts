/**
 * POST /api/internal/connect-jobs/drain — connect background worker (cron).
 *
 * Drains queued connect jobs (enrollment-subscription transitions + offering plan
 * creation) and reconciles lapsed recurring subscriptions (grace-to-period-end
 * teardown). Authenticated by INTERNAL_CRON_TOKEN (middleware + handler). No-ops
 * when teacherConnect is off so it is safe to schedule before launch.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireInternal } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { drainConnectJobs } from "@/server/connect/connect-jobs";
import { reconcileEnrollmentSubscriptions } from "@/server/connect/enrollment-subscription-service";
import { reconcileLapsedSubjectGrants } from "@/server/premium-access-admin-service";
import { reconcileQuotaFilledCodes } from "@/server/workspaces/code-access-admin-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    // Expire lapsed subject grants (incl. admin_comp auto-revert windows) and fix
    // the is_premium mirror. Flag-independent — mirror correctness must hold even
    // when teacherConnect is off, so this runs before the early-return below.
    const grants = await reconcileLapsedSubjectGrants();
    // Feature A safety net: disable any student_join code whose quota is full but
    // that the inline redeem enforcement didn't catch. Only when the flag is on.
    const quotaCodes = isFeatureEnabled("teacherCodeApproval")
      ? await reconcileQuotaFilledCodes()
      : { revoked: 0 };
    if (!isFeatureEnabled("teacherConnect")) {
      return NextResponse.json({ ok: true, skipped: "teacherConnect disabled", grants, quotaCodes });
    }
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 25);
    const drain = await drainConnectJobs(limit);
    const reconcile = await reconcileEnrollmentSubscriptions();
    return NextResponse.json({ ok: true, drain, reconcile, grants, quotaCodes });
  } catch (error) {
    return handleTeacherError(error);
  }
}
