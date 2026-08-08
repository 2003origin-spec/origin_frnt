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
import { reconcileCbtParticipations } from "@/server/cbt/cbt-quota-service";
import { sweepExpiredTeacherDpps } from "@/server/teacher-dpp-sweeper";
import { isFeatureEnabled } from "@/lib/feature-flags";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function drain(request: NextRequest) {
  try {
    await requireCronCaller(request);

    // Teacher test → batch DPP: reclaim shares past their 30 days (plan
    // V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md). It rides this tick rather than
    // owning a route because this is the one internal cron proven to fire in
    // production, and because a brand-new route file is exposed to the Next-16
    // phantom-404 incident. Deliberately ABOVE the cbtModule gate and inside its
    // own try/catch: it is unrelated to CBT, so neither feature's flag or
    // failure may take the other down. Expiry itself does NOT depend on this —
    // both the eligibility query and the student DPP list filter on expires_at,
    // so a missed tick only delays reclaiming storage.
    let teacherDpp = null;
    try {
      if (isFeatureEnabled("teacherDppShare")) {
        teacherDpp = await sweepExpiredTeacherDpps(200);
      }
    } catch (error) {
      console.error("[cbt/drain] teacher DPP expiry sweep failed", error);
    }

    if (!isFeatureEnabled("cbtModule")) {
      return NextResponse.json({ ok: true, skipped: "cbt_disabled", teacherDpp });
    }

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

    // Participation-quota safety net: the inline metering in recordHeartbeat /
    // saveAnswers is the primary path and swallows its own failures, so this
    // catches the rows a DB blip (or a deploy landing mid-test) missed. It is
    // scoped to live/recent rooms, so it can never retro-charge closed history.
    let quota = null;
    try {
      quota = await reconcileCbtParticipations();
    } catch (error) {
      console.error("[cbt/drain] participation reconcile failed", error);
    }

    return NextResponse.json({ ok: true, ...result, backfill, quota, teacherDpp });
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
