/**
 * GET | POST /api/internal/contest/retention — data-retention sweep (cron).
 *
 * Purges answer_drafts of published contests and archives+reclaims the raw
 * submission_answers of contests past the retention window (a single DROP TABLE
 * per contest). Idempotent — safe every tick. See contest-retention-service.
 *
 * GET because Vercel Cron issues GET (POST kept for manual trigger).
 * Auth: requireCronCaller. Gated by the `contest` flag.
 *
 * Plan Phase 9.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runContestRetention } from "@/server/contest/contest-retention-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    const result = await runContestRetention();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
