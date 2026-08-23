/**
 * GET | POST /api/internal/contest/schedule-run — auto-schedule tick (cron).
 *
 * Creates + auto-publishes the next occurrence of each active recurring schedule
 * when its registration window opens, and advances the schedule. Idempotent.
 * Auth: requireCronCaller. Gated by the `contest` flag. Plan: auto-scheduling.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runDueSchedules } from "@/server/contest/contest-schedule-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    const result = await runDueSchedules();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
