/**
 * GET | POST /api/internal/contest/finalize — deadline auto-submit sweep (cron).
 *
 * Auto-submits every attempt still open past its contest deadline (end_at +
 * grace) from the durable draft, via the idempotent submitAttempt. The
 * unattended backstop that makes an abandoned attempt a graded row.
 *
 * GET because Vercel Cron issues GET (POST kept for manual trigger).
 * Auth: requireCronCaller. Gated by the `contest` flag.
 *
 * Plan Phase 4.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { sweepExpiredAttempts } from "@/server/contest/contest-finalize-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    const result = await sweepExpiredAttempts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
