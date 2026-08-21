/**
 * GET | POST /api/internal/contest/drain — contest autosave-buffer drain (cron).
 *
 * For every LIVE contest, invokes contest-service /v1/drain to batch-flush the
 * Redis autosave buffer into contest.answer_drafts. This is what keeps the
 * durable checkpoint fresh without the hot autosave path ever touching Neon.
 *
 * GET exists because **Vercel Cron issues GET** (POST kept for manual trigger).
 * Auth: INTERNAL_CRON_TOKEN or Vercel's own CRON_SECRET (requireCronCaller).
 * Gated by the `contest` flag. Fail-open per-contest: one contest's drain error
 * never blocks the others.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listLiveContestIds } from "@/server/contest/contest-admin-service";
import { drainContest, isContestServiceConfigured } from "@/server/contest/contest-service-client";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function drain(request: NextRequest) {
  try {
    await requireCronCaller(request);

    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    if (!isContestServiceConfigured()) {
      return NextResponse.json({ ok: true, skipped: "CONTEST_SERVICE_URL unset" });
    }

    const liveIds = await listLiveContestIds();
    const results: Array<{ contestId: string; ok: boolean; drained?: number; error?: string }> = [];
    for (const contestId of liveIds) {
      try {
        const res = await drainContest(contestId);
        const drained =
          res.body && typeof res.body === "object" && "drained" in res.body
            ? (res.body as { drained?: number }).drained
            : undefined;
        results.push({ contestId, ok: res.ok, drained });
      } catch (error) {
        // Fail-open: a single contest's drain failure must not stop the others.
        results.push({
          contestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({ ok: true, liveContests: liveIds.length, results });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = drain;
export const POST = drain;
