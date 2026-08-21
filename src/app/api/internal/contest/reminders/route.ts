/**
 * GET | POST /api/internal/contest/reminders — contest reminder fan-out (cron).
 *
 * For each UPCOMING scheduled contest, sends whichever start-relative reminders
 * (T-24h / T-1h / T-10m) are currently due to the registered users who haven't
 * gotten them yet (idempotent via contest.reminders_sent). Batched per contest.
 *
 * GET because Vercel Cron issues GET (POST kept for manual trigger).
 * Auth: requireCronCaller. Gated by the `contest` flag.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 2b.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getUserPostgresPool } from "@/server/user-postgres";
import { ensureContestSchema } from "@/server/contest/contest-schema";
import { sendContestReminder } from "@/server/contest/contest-reminders-service";
import { dueStartReminders } from "@/lib/contest/reminders";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isFeatureEnabled("contest")) {
      return NextResponse.json({ ok: true, skipped: "contest flag off" });
    }
    await ensureContestSchema();
    const pool = getUserPostgresPool();
    if (!pool) return NextResponse.json({ ok: true, skipped: "db unconfigured" });

    // Upcoming scheduled contests within the next 24h+ (anything not yet started
    // and not ended). Reminders only fire pre-start.
    const contests = await pool.query<{ id: string; name: string; start_at: string | null }>(
      `SELECT id, name, start_at FROM contest.contests
        WHERE status = 'scheduled' AND start_at IS NOT NULL AND NOW() < start_at`,
    );

    const now = new Date();
    const results: Array<{ contestId: string; kind: string; sent: number }> = [];
    for (const c of contests.rows) {
      const due = dueStartReminders(c.start_at ? new Date(c.start_at) : null, now);
      for (const kind of due) {
        try {
          const sent = await sendContestReminder(c.id, c.name, kind);
          if (sent > 0) results.push({ contestId: c.id, kind, sent });
        } catch (error) {
          // fail-open per (contest, kind)
          results.push({ contestId: c.id, kind, sent: -1 });
          console.error("[contest reminders] send failed", c.id, kind, error);
        }
      }
    }

    return NextResponse.json({ ok: true, contests: contests.rows.length, results });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export const GET = run;
export const POST = run;
