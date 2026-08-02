/**
 * GET | POST /api/internal/cbt/drain — CBT room auto-submit sweep (cron).
 *
 * Auto-submits participants in rooms past their deadline (start + duration +
 * 10s grace) from their server-held drafts, then finishes those rooms. This is
 * the unattended backstop that makes "went offline and never came back" a
 * scored attempt instead of a blank "absent" row. Teacher reads (room view,
 * leaderboard, export) finalize lazily on their own, so this only has to cover
 * rooms nobody is looking at.
 *
 * GET exists because **Vercel Cron issues GET** — this route was POST-only,
 * which is a large part of why the sweep never actually ran in production. POST
 * is kept for manual triggering.
 *
 * Each tick also advances the online half of the 20260802 migration (concurrent
 * index builds, chunked backfill, constraint validation) inside a small time
 * budget, so production converges by itself after a deploy without anyone
 * running a script. It short-circuits once complete.
 *
 * Auth: INTERNAL_CRON_TOKEN or Vercel's own CRON_SECRET.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { sweepExpiredCbtRooms } from "@/server/cbt/cbt-attempts-service";
import { advanceCbtResilienceBackfill } from "@/server/cbt/cbt-backfill";
import { isFeatureEnabled } from "@/lib/feature-flags";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function drain(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("cbtModule")) return NextResponse.json({ ok: true, skipped: "cbt_disabled" });

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 200);
    const result = await sweepExpiredCbtRooms(limit);

    // Best-effort: a backfill hiccup must never fail the sweep.
    let backfill = null;
    try {
      backfill = await advanceCbtResilienceBackfill({ budgetMs: 2_000 });
    } catch (error) {
      console.error("[cbt/drain] resilience backfill tick failed", error);
    }

    return NextResponse.json({ ok: true, ...result, backfill });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  return drain(request);
}

export async function POST(request: NextRequest) {
  return drain(request);
}
