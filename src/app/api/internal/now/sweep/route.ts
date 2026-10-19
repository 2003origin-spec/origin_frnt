/**
 * GET | POST /api/internal/now/sweep — Origin NOW backstop, every minute.
 *
 * Expires overdue offers, re-dispatches waiting requests, handles no-shows,
 * ends overrun sessions and settles ended ones: everything a late or missing
 * QStash timer would have done. Idempotent. No-op while `originNow` is off.
 *
 * GET because Vercel Cron issues GET (POST kept for manual trigger).
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleTeacherError } from "@/app/api/teacher/_utils";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireCronCaller } from "@/server/authz";
import { runNowSweep } from "@/server/now/session-service";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("originNow")) return NextResponse.json({ ok: true, skipped: "originNow flag off" });
    return NextResponse.json({ ok: true, ...(await runNowSweep()) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
