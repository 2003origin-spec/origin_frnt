/**
 * GET | POST /api/internal/now/nightly — Origin NOW daily jobs: closes 24 h
 * rating windows, audits the coin ledger (every transfer must balance) and
 * deletes call recordings past retention (unless a report is still open).
 * Idempotent. No-op while `originNow` is off.
 *
 * GET because Vercel Cron issues GET (POST kept for manual trigger).
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleTeacherError } from "@/app/api/teacher/_utils";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireCronCaller } from "@/server/authz";
import { runNowNightly } from "@/server/now/session-service";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("originNow")) return NextResponse.json({ ok: true, skipped: "originNow flag off" });
    return NextResponse.json({ ok: true, ...(await runNowNightly()) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
