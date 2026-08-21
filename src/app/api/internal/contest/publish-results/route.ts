/**
 * GET | POST /api/internal/contest/publish-results — results pipeline (cron).
 *
 * For any contest that has ended and whose attempts are all finalized, ranks
 * and publishes the results (scheduled → result_processing → result_published)
 * and fires the "results published" reminder. Idempotent.
 *
 * GET because Vercel Cron issues GET. Auth: requireCronCaller. `contest` flag.
 * Plan Phase 6.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { processEndedContests } from "@/server/contest/contest-results-pipeline";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    const result = await processEndedContests();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
