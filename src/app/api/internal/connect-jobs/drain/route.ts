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
import { dbRevokeDormantSessions } from "@/server/db-users";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    // Expire lapsed subject grants (incl. admin_comp auto-revert windows) and fix
    // the is_premium mirror. Flag-independent — mirror correctness must hold even
    // when teacherConnect is off, so this runs before the early-return below.
    const grants = await reconcileLapsedSubjectGrants();
    // Backstop for the until-sign-out android refresh lifetime: revoke sessions
    // dormant for a year. Flag-independent for the same reason as the grants
    // reconcile above — this is a security invariant, not a feature behaviour.
    let sessions = { revoked: 0 };
    try {
      sessions = await dbRevokeDormantSessions();
    } catch (error) {
      // Never fail the whole drain on the sweep; it is idempotent and retries
      // on the next cron tick.
      console.error(
        "[connect-jobs-drain] dormant session sweep failed",
        error instanceof Error ? error.message : error,
      );
    }
    // Feature A safety net: disable any student_join code whose quota is full but
    // that the inline redeem enforcement didn't catch. Only when the flag is on.
    const quotaCodes = isFeatureEnabled("teacherCodeApproval")
      ? await reconcileQuotaFilledCodes()
      : { revoked: 0 };
    if (!isFeatureEnabled("teacherConnect")) {
      return NextResponse.json({ ok: true, skipped: "teacherConnect disabled", grants, quotaCodes, sessions });
    }
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 25);
    const drain = await drainConnectJobs(limit);
    const reconcile = await reconcileEnrollmentSubscriptions();
    return NextResponse.json({ ok: true, drain, reconcile, grants, quotaCodes, sessions });
  } catch (error) {
    return handleTeacherError(error);
  }
}
